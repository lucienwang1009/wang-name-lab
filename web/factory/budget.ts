import type {
  FactoryPhase,
  FactoryRequestRecord,
  FactoryRunConfig,
  TokenUsage,
} from "./types.ts";

export const MICRO_CNY = 1_000_000;

export class BudgetExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BudgetExceededError";
  }
}

const zeroUsage = (): TokenUsage => ({
  inputTokens: 0,
  cachedInputTokens: 0,
  outputTokens: 0,
  reasoningTokens: 0,
});

function toMicroCny(cny: number): number {
  return Math.round(cny * MICRO_CNY);
}

export function microCnyToCny(value: number): number {
  return value / MICRO_CNY;
}

export function estimateUsageMicroCny(
  usage: TokenUsage,
  pricing: FactoryRunConfig["pricingUsdPerMillion"],
  cnyPerUsd: number,
): number {
  const cached = Math.min(usage.inputTokens, Math.max(0, usage.cachedInputTokens));
  const uncached = Math.max(0, usage.inputTokens - cached);
  const usd = (
    cached * pricing.inputCacheHit +
    uncached * pricing.inputCacheMiss +
    Math.max(0, usage.outputTokens) * pricing.output
  ) / 1_000_000;
  return toMicroCny(usd * cnyPerUsd);
}

export interface BudgetReservation {
  id: string;
  phase: FactoryPhase;
  reservedMicroCny: number;
  usageEstimate: TokenUsage;
}

function phaseLimit(config: FactoryRunConfig, phase: FactoryPhase): number {
  const values = config.phaseBudgetCny;
  switch (phase) {
    case "calibration": return values.calibration;
    case "generation": return values.generation;
    case "semantic-review": return values.semanticReview;
    case "name-review": return values.nameReview;
    case "adversarial-review": return values.adversarialReview;
    case "retry": return values.retry;
  }
}

export class BudgetLedger {
  readonly records: FactoryRequestRecord[] = [];
  readonly #config: FactoryRunConfig;
  readonly #reservations = new Map<string, BudgetReservation>();
  readonly #spentByPhase = new Map<FactoryPhase, number>();
  #reservationSequence = 0;

  constructor(config: FactoryRunConfig) {
    this.#config = config;
  }

  get spentMicroCny(): number {
    return this.records.reduce((sum, record) => sum + record.estimatedMicroCny, 0);
  }

  get reservedMicroCny(): number {
    return [...this.#reservations.values()].reduce(
      (sum, reservation) => sum + reservation.reservedMicroCny,
      0,
    );
  }

  get remainingMicroCny(): number {
    return Math.max(0, toMicroCny(this.#config.maxCny) - this.spentMicroCny - this.reservedMicroCny);
  }

  reserve(phase: FactoryPhase, usageEstimate: TokenUsage): BudgetReservation {
    const estimated = estimateUsageMicroCny(
      usageEstimate,
      this.#config.pricingUsdPerMillion,
      this.#config.cnyPerUsd,
    );
    const totalLimit = toMicroCny(this.#config.maxCny);
    if (this.spentMicroCny + this.reservedMicroCny + estimated > totalLimit) {
      throw new BudgetExceededError(
        `下一次请求的最坏情况估算将超过 ${this.#config.maxCny.toFixed(2)} 元总预算。`,
      );
    }
    const phaseSpent = this.#spentByPhase.get(phase) ?? 0;
    const phaseReserved = [...this.#reservations.values()]
      .filter((reservation) => reservation.phase === phase)
      .reduce((sum, reservation) => sum + reservation.reservedMicroCny, 0);
    const limit = toMicroCny(phaseLimit(this.#config, phase));
    if (phaseSpent + phaseReserved + estimated > limit) {
      throw new BudgetExceededError(
        `${phase} 阶段的下一次请求将超过 ${phaseLimit(this.#config, phase).toFixed(2)} 元预算。`,
      );
    }
    const reservation: BudgetReservation = {
      id: `reservation-${this.#reservationSequence += 1}`,
      phase,
      reservedMicroCny: estimated,
      usageEstimate: { ...usageEstimate },
    };
    this.#reservations.set(reservation.id, reservation);
    return reservation;
  }

  release(reservation: BudgetReservation): void {
    this.#reservations.delete(reservation.id);
  }

  commit(
    reservation: BudgetReservation,
    {
      cacheKey,
      role,
      usage,
      cached = false,
    }: { cacheKey: string; role: string; usage?: TokenUsage; cached?: boolean },
  ): FactoryRequestRecord {
    const active = this.#reservations.get(reservation.id);
    if (!active) throw new Error(`预算预留 ${reservation.id} 不存在或已经结算。`);
    this.#reservations.delete(reservation.id);
    const actualUsage = usage ? { ...usage } : zeroUsage();
    const estimatedMicroCny = cached
      ? 0
      : estimateUsageMicroCny(
          actualUsage,
          this.#config.pricingUsdPerMillion,
          this.#config.cnyPerUsd,
        );
    const record: FactoryRequestRecord = {
      cacheKey,
      phase: reservation.phase,
      role,
      usage: actualUsage,
      estimatedMicroCny,
      cached,
    };
    this.records.push(record);
    this.#spentByPhase.set(
      reservation.phase,
      (this.#spentByPhase.get(reservation.phase) ?? 0) + estimatedMicroCny,
    );
    return record;
  }

  recordCacheHit({ cacheKey, phase, role }: { cacheKey: string; phase: FactoryPhase; role: string }): FactoryRequestRecord {
    const record: FactoryRequestRecord = {
      cacheKey,
      phase,
      role,
      usage: zeroUsage(),
      estimatedMicroCny: 0,
      cached: true,
    };
    this.records.push(record);
    return record;
  }
}

