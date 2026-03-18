// ============================================================
// Agent-to-Agent Commerce Agent
// ============================================================
// This agent participates in a marketplace where agents trade
// services for micropayments. It can both:
//   - SELL: Register services and fulfill requests from buyers
//   - BUY: Discover services, evaluate them, and purchase
//
// This is the most complex agent and the most novel for the
// hackathon — demonstrating autonomous economic agents that
// negotiate and transact without human intervention.
//
// Architecture:
//   Agent A (seller): registers "Weather Data Feed" for 1000 shannons
//   Agent B (buyer): discovers the service, evaluates price,
//                    pays via Fiber, receives the data
//
// The optional Claude AI integration makes the buyer agent
// intelligent — it can evaluate service descriptions, compare
// prices, and decide whether a purchase is worthwhile.
// ============================================================

import {
  type CommerceAgentConfig,
  type ServiceListing,
  type ServiceRequest,
  now,
  sleep,
  generateId,
} from "@fiber-agent-pay/core";
import { FiberClient } from "@fiber-agent-pay/fiber-client";
import { Wallet } from "@fiber-agent-pay/ckb-client";
import { BaseAgent } from "./base-agent.js";
import type { SafetyLimits } from "./safety.js";

/**
 * In-memory service registry.
 *
 * In a production system, this would be a decentralized registry
 * (perhaps stored on-chain or in a DHT). For the hackathon,
 * a shared in-memory registry demonstrates the concept.
 *
 * Why static/shared?
 * All commerce agents in the same process need to see each
 * other's services. A static registry simulates a network-wide
 * service directory.
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

  /** Reset registry (useful for testing) */
  static clear(): void {
    this.services.clear();
    this.requests.clear();
  }
}

export class CommerceAgent extends BaseAgent {
  declare config: CommerceAgentConfig;

  constructor(
    config: CommerceAgentConfig,
    fiberClient: FiberClient,
    wallet: Wallet,
    safetyLimits?: Partial<SafetyLimits>,
  ) {
    super(config, fiberClient, wallet, safetyLimits);
  }

  /**
   * Commerce agent execution loop.
   *
   * Unlike DCA/Stream which have a simple timer loop, the
   * commerce agent alternates between two roles:
   *   1. Provider: Check for incoming requests and fulfill them
   *   2. Consumer: Discover services and make purchases
   *
   * This dual-role design means a single agent can both earn
   * and spend — creating a self-sustaining agent economy.
   */
  protected async execute(): Promise<void> {
    console.log(
      `[Commerce Agent ${this.config.id}] Starting — ` +
      `Offering ${this.config.offeredServices.length} services, ` +
      `Looking for: ${this.config.desiredServices.join(", ")}`,
    );

    // Register our services in the marketplace
    for (const service of this.config.offeredServices) {
      ServiceRegistry.registerService({
        ...service,
        providerId: this.config.id,
        isActive: true,
      });
      this.emitEvent({
        type: "commerce:service_listed",
        agentId: this.config.id,
        service: { ...service, providerId: this.config.id, isActive: true },
        timestamp: now(),
      });
    }

    // Main commerce loop
    while (this.shouldContinue()) {
      while (this.status === "paused") {
        await sleep(1000);
        if (this.abortController.signal.aborted) return;
      }

      // --- Provider role: fulfill incoming requests ---
      await this.handleIncomingRequests();

      // --- Consumer role: discover and purchase services ---
      await this.discoverAndPurchase();

      // Poll every 5 seconds
      const shouldProceed = await this.waitInterval(5000);
      if (!shouldProceed) break;
    }

    // Unregister services on shutdown
    for (const service of this.config.offeredServices) {
      ServiceRegistry.unregisterService(service.serviceId);
    }

    console.log(
      `[Commerce Agent ${this.config.id}] Shutdown — ` +
      `${this.paymentCount} transactions completed`,
    );
  }

  /**
   * Handle requests from other agents for our services.
   *
   * When another agent pays for our service, we:
   *   1. Find the pending request
   *   2. Generate the result (data, computation, etc.)
   *   3. Mark the request as fulfilled
   *
   * In production, the "generate result" step would call real
   * APIs, run computations, or query data feeds. For the hackathon
   * demo, we simulate the service fulfillment.
   */
  private async handleIncomingRequests(): Promise<void> {
    const requests = ServiceRegistry.getRequestsForProvider(this.config.id);

    for (const request of requests) {
      const service = ServiceRegistry.getService(request.serviceId);
      if (!service) continue;

      try {
        // Simulate service fulfillment
        const result = await this.fulfillService(service, request);

        ServiceRegistry.updateRequest(request.requestId, {
          status: "fulfilled",
          result,
          fulfilledAt: now(),
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
          `[Commerce Agent ${this.config.id}] Fulfilled request ` +
          `${request.requestId} for service "${service.name}"`,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(
          `[Commerce Agent ${this.config.id}] Failed to fulfill request: ${message}`,
        );
        ServiceRegistry.updateRequest(request.requestId, { status: "failed" });
      }
    }
  }

  /**
   * Discover services offered by other agents and purchase them.
   *
   * The agent looks for services matching its desiredServices list,
   * evaluates the price, and pays via Fiber if it's within budget.
   *
   * With AI negotiation enabled, the agent uses Claude to evaluate
   * whether a service is worth its price — a primitive form of
   * autonomous economic reasoning.
   */
  private async discoverAndPurchase(): Promise<void> {
    for (const desiredCategory of this.config.desiredServices) {
      const available = ServiceRegistry.findServices(desiredCategory);

      // Filter out our own services and find affordable ones
      const candidates = available.filter(
        (s) =>
          s.providerId !== this.config.id &&
          s.pricePerRequest <= this.config.maxPricePerRequest,
      );

      if (candidates.length === 0) continue;

      // Select the best candidate
      // Simple strategy: cheapest service. With AI enabled,
      // we'd evaluate description quality, provider reputation, etc.
      const selected = candidates.sort((a, b) =>
        Number(a.pricePerRequest - b.pricePerRequest),
      )[0];

      // Attempt to purchase
      try {
        const payment = await this.safePayment(
          `commerce-${this.config.id}-${selected.serviceId}-${now()}`,
          selected.pricePerRequest,
        );

        if (payment) {
          // Create a service request
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
            `[Commerce Agent ${this.config.id}] Purchased "${selected.name}" ` +
            `from agent ${selected.providerId} for ${selected.pricePerRequest} shannons`,
          );
        }
      } catch (err) {
        // Purchase failed — not critical, will retry next cycle
        const message = err instanceof Error ? err.message : String(err);
        console.error(
          `[Commerce Agent ${this.config.id}] Purchase failed: ${message}`,
        );
      }
    }
  }

  /**
   * Simulate fulfilling a service request.
   *
   * In a real system, this would:
   *   - data_feed: Return real-time data from an API
   *   - computation: Run analysis and return results
   *   - oracle: Fetch and verify external data
   *   - storage: Store/retrieve data
   *
   * For the hackathon demo, we return simulated results.
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
            source: `agent-${this.config.id}`,
          },
        });

      case "computation":
        return JSON.stringify({
          type: "computation",
          service: service.name,
          result: {
            timestamp: now(),
            output: `Computed result from agent ${this.config.id}`,
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
