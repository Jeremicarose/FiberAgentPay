// ============================================================
// Agent-to-Agent Commerce Agent — The Economic Actor
// ============================================================
// This is the core of the agent economy. Each Commerce agent:
//   - SELLS services and earns real CKB
//   - BUYS services from other agents with real CKB transfers
//   - REINVESTS a percentage of earnings (DCA-style budgeting)
//   - Makes decisions based on budget constraints (not blind spending)
//
// The full economic loop:
//   earn → spend → reinvest → repeat
//
// Three behaviors embedded in one agent:
//   Commerce: discovers WHAT to buy
//   Stream:   HOW to pay (chunked payments for large purchases)
//   DCA:      HOW to sustain (reinvestPercent allocates earnings)
//
// Each payment creates a real CKB transaction between different
// wallet addresses — verifiable on the CKB testnet explorer.
// ============================================================

import {
  type CommerceAgentConfig,
  type ServiceListing,
  type ServiceRequest,
  type FiberPayment,
  now,
  sleep,
  generateId,
} from "@fiber-agent-pay/core";
import { FiberClient } from "@fiber-agent-pay/fiber-client";
import { Wallet } from "@fiber-agent-pay/ckb-client";
import { BaseAgent } from "./base-agent.js";
import type { SafetyLimits } from "./safety.js";

/**
 * In-memory service registry — the marketplace.
 *
 * All commerce agents share this registry to discover each other's
 * services. It now includes provider wallet addresses so buyers
 * know where to send CKB.
 */
export class ServiceRegistry {
  private static services: Map<string, ServiceListing> = new Map();
  private static requests: Map<string, ServiceRequest> = new Map();

  static registerService(service: ServiceListing): void {
    this.services.set(service.serviceId, service);
  }

  static unregisterService(serviceId: string): void {
    this.services.delete(serviceId);
  }

  static findServices(category?: string): ServiceListing[] {
    const all = Array.from(this.services.values()).filter((s) => s.isActive);
    if (category) {
      return all.filter((s) => s.category === category);
    }
    return all;
  }

  static getService(serviceId: string): ServiceListing | undefined {
    return this.services.get(serviceId);
  }

  static submitRequest(request: ServiceRequest): void {
    this.requests.set(request.requestId, request);
  }

  static getRequestsForProvider(providerId: string): ServiceRequest[] {
    return Array.from(this.requests.values()).filter(
      (r) => r.providerId === providerId && r.status === "paid",
    );
  }

  static updateRequest(requestId: string, update: Partial<ServiceRequest>): void {
    const existing = this.requests.get(requestId);
    if (existing) {
      this.requests.set(requestId, { ...existing, ...update });
    }
  }

  static clear(): void {
    this.services.clear();
    this.requests.clear();
  }
}

export class CommerceAgent extends BaseAgent {
  declare config: CommerceAgentConfig;

  // Friction: skip buying occasionally to prevent hot-potato loops
  private cycleCount: number = 0;

  constructor(
    config: CommerceAgentConfig,
    fiberClient: FiberClient,
    wallet: Wallet,
    safetyLimits?: Partial<SafetyLimits>,
  ) {
    super(config, fiberClient, wallet, safetyLimits);
  }

  /**
   * Commerce agent execution loop — the economic actor.
   *
   * Each cycle:
   *   1. Provider: check for paid requests and fulfill them (earn)
   *   2. Consumer: discover services and buy if budget allows (spend)
   *   3. Wait 5 seconds, repeat
   *
   * Budget check prevents blind spending:
   *   availableBudget = initialFunds + (earnings * reinvestPercent / 100) - totalSpent
   *   Only buy if budget covers the price.
   */
  protected async execute(): Promise<void> {
    const reinvest = this.config.reinvestPercent ?? 80;
    console.log(
      `[Commerce ${this.config.id.slice(0, 8)}] Starting — ` +
      `Selling ${this.config.offeredServices.length} services, ` +
      `Buying: ${this.config.desiredServices.join(", ") || "nothing"}, ` +
      `Reinvest: ${reinvest}%`,
    );

    // Register our services with our wallet address
    // Ensure pricePerRequest is BigInt (may arrive as string from JSON)
    for (const service of this.config.offeredServices) {
      const listing: ServiceListing = {
        ...service,
        pricePerRequest: BigInt(service.pricePerRequest),
        providerId: this.config.id,
        providerAddress: this.wallet.address,
        isActive: true,
      };
      ServiceRegistry.registerService(listing);
      this.emitEvent({
        type: "commerce:service_listed",
        agentId: this.config.id,
        service: listing,
        timestamp: now(),
      });
    }

    // Main commerce loop
    while (this.shouldContinue()) {
      while (this.status === "paused") {
        await sleep(1000);
        if (this.abortController.signal.aborted) return;
      }

      this.cycleCount++;

      // --- Provider role: fulfill requests and EARN ---
      await this.handleIncomingRequests();

      // --- Consumer role: discover, evaluate, and BUY ---
      // Add friction: skip buying on some cycles (30% chance to "think")
      // This prevents agents from blindly passing CKB back and forth
      if (Math.random() > 0.3) {
        await this.discoverAndPurchase();
      } else if (this.cycleCount % 5 === 0) {
        console.log(
          `[Commerce ${this.config.id.slice(0, 8)}] Cycle ${this.cycleCount}: evaluating market (skipping purchase)`,
        );
      }

      // Refresh balance periodically (every 3 cycles)
      if (this.cycleCount % 3 === 0) {
        await this.refreshBalance();
      }

      // Poll every 5 seconds
      const shouldProceed = await this.waitInterval(5000);
      if (!shouldProceed) break;
    }

    // Unregister services on shutdown
    for (const service of this.config.offeredServices) {
      ServiceRegistry.unregisterService(service.serviceId);
    }

    console.log(
      `[Commerce ${this.config.id.slice(0, 8)}] Shutdown — ` +
      `Earned: ${this.earnings} shannons, Spent: ${this.totalSpent} shannons, ` +
      `Net: ${this.earnings - this.totalSpent} shannons`,
    );
  }

  /**
   * Handle requests from other agents — EARN CKB.
   *
   * When another agent pays for our service:
   *   1. Find pending (paid) requests
   *   2. Fulfill the service (generate result)
   *   3. Record earnings
   *   4. Emit payment:received event
   *
   * The CKB has already been transferred to our wallet address
   * by the buyer's safePayment(). We just fulfill and record.
   */
  private async handleIncomingRequests(): Promise<void> {
    const requests = ServiceRegistry.getRequestsForProvider(this.config.id);

    for (const request of requests) {
      const service = ServiceRegistry.getService(request.serviceId);
      if (!service) continue;

      try {
        const result = await this.fulfillService(service, request);

        // Record the earning
        const servicePrice = BigInt(service.pricePerRequest);
        this.addEarnings(servicePrice);

        ServiceRegistry.updateRequest(request.requestId, {
          status: "fulfilled",
          result,
          fulfilledAt: now(),
        });

        // Emit payment:received — the earning event
        this.emitEvent({
          type: "payment:received",
          agentId: this.config.id,
          payment: {
            id: generateId(),
            agentId: this.config.id,
            channelId: "",
            amount: servicePrice,
            paymentHash: request.paymentHash ?? "",
            status: "completed",
            direction: "inbound",
            timestamp: now(),
          },
          timestamp: now(),
        });

        this.emitEvent({
          type: "commerce:request_fulfilled",
          agentId: this.config.id,
          request: {
            ...request,
            status: "fulfilled",
            result,
            fulfilledAt: now(),
          },
          timestamp: now(),
        });

        console.log(
          `[Commerce ${this.config.id.slice(0, 8)}] EARNED ${service.pricePerRequest} shannons ` +
          `from ${request.requesterId.slice(0, 8)} for "${service.name}" ` +
          `(total earned: ${this.earnings})`,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(
          `[Commerce ${this.config.id.slice(0, 8)}] Failed to fulfill: ${message}`,
        );
        ServiceRegistry.updateRequest(request.requestId, { status: "failed" });
      }
    }
  }

  /**
   * Discover services and purchase — SPEND CKB.
   *
   * Budget-aware purchasing:
   *   1. Calculate available budget from earnings * reinvestPercent
   *   2. Find affordable services from other agents
   *   3. Pay to the seller's wallet address (real CKB transfer)
   *   4. Submit service request
   *
   * This is where DCA behavior is embedded:
   *   reinvestPercent controls how much of earnings go to purchases.
   *   100% = aggressive reinvestment
   *   50% = save half
   *   0% = pure seller, never buys
   */
  private async discoverAndPurchase(): Promise<void> {
    const reinvest = this.config.reinvestPercent ?? 80;

    // Budget = portion of earnings allocated to spending
    // Plus initial wallet balance (for bootstrapping before first sale)
    const earningsBudget = (this.earnings * BigInt(reinvest)) / 100n;
    const availableBudget = earningsBudget + this.cachedBalance - this.totalSpent;

    for (const desiredCategory of this.config.desiredServices) {
      const available = ServiceRegistry.findServices(desiredCategory);

      // Filter: not our own services, affordable, within budget
      // Ensure BigInt comparisons (prices may arrive as strings from JSON)
      const candidates = available.filter(
        (s) => {
          const price = BigInt(s.pricePerRequest);
          return s.providerId !== this.config.id &&
            price <= this.config.maxPricePerRequest &&
            price <= availableBudget;
        },
      );

      if (candidates.length === 0) continue;

      // Select based on price — cheapest first (economic rationality)
      const selected = candidates.sort((a, b) =>
        Number(BigInt(a.pricePerRequest) - BigInt(b.pricePerRequest)),
      )[0];

      try {
        // Pay to the seller's wallet address — real CKB transfer
        const price = BigInt(selected.pricePerRequest);
        const payment = await this.safePayment(
          `Purchase "${selected.name}" from ${selected.providerId.slice(0, 8)}`,
          price,
          selected.providerAddress,
        );

        if (payment) {
          // Create a service request so the seller knows to fulfill
          const request: ServiceRequest = {
            requestId: generateId(),
            serviceId: selected.serviceId,
            requesterId: this.config.id,
            providerId: selected.providerId,
            paymentHash: payment.paymentHash,
            status: "paid",
            requestedAt: now(),
          };

          ServiceRegistry.submitRequest(request);

          console.log(
            `[Commerce ${this.config.id.slice(0, 8)}] SPENT ${price} shannons ` +
            `→ ${selected.providerId.slice(0, 8)} for "${selected.name}" ` +
            `(budget remaining: ${availableBudget - price})`,
          );
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(
          `[Commerce ${this.config.id.slice(0, 8)}] Purchase failed: ${message}`,
        );
      }
    }
  }

  /**
   * Simulate fulfilling a service request.
   *
   * In production, this would call real APIs or run computations.
   * Prices vary by service category to create economic differentiation:
   *   data_feed: cheaper (raw data)
   *   computation: expensive (analysis work)
   *   oracle: mid-range (verification)
   */
  private async fulfillService(
    service: ServiceListing,
    _request: ServiceRequest,
  ): Promise<string> {
    switch (service.category) {
      case "data_feed":
        return JSON.stringify({
          type: "data_feed",
          service: service.name,
          data: {
            timestamp: now(),
            value: Math.random() * 1000,
            source: `agent-${this.config.id.slice(0, 8)}`,
          },
        });

      case "computation":
        return JSON.stringify({
          type: "computation",
          service: service.name,
          result: {
            timestamp: now(),
            output: `Analysis from agent ${this.config.id.slice(0, 8)}`,
            processingTimeMs: Math.floor(Math.random() * 500),
          },
        });

      case "oracle":
        return JSON.stringify({
          type: "oracle",
          service: service.name,
          data: {
            timestamp: now(),
            price: (Math.random() * 50000).toFixed(2),
            asset: "CKB/USD",
          },
        });

      default:
        return JSON.stringify({
          type: service.category,
          service: service.name,
          result: "Service fulfilled",
          timestamp: now(),
        });
    }
  }
}
