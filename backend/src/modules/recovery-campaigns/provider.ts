export interface PaymentProviderContext {
  id: string;
  merchantId: string;
  amount: string;
  paymentMethod: 'upi' | 'card' | 'net_banking';
  createdAt: Date | null;
  attemptCount: number;
}

export type PaymentProviderOutcome = {
  status: 'success' | 'failed';
  recoveredAmount: string;
  failureReason?: string;
};

export interface PaymentProvider {
  execute(payment: PaymentProviderContext, attemptNumber: number, campaignId: string): PaymentProviderOutcome;
}

export class RecoveryService {
  constructor(private readonly provider: PaymentProvider = new MockPaymentProvider()) {}

  execute(payment: PaymentProviderContext, attemptNumber: number, campaignId: string): PaymentProviderOutcome {
    return this.provider.execute(payment, attemptNumber, campaignId);
  }
}

export class MockPaymentProvider implements PaymentProvider {
  execute(payment: PaymentProviderContext, attemptNumber: number, campaignId: string): PaymentProviderOutcome {
    const seed = stableHash(`${campaignId}:${payment.id}:${attemptNumber}`);
    const methodBias = {
      upi: 18,
      card: 25,
      'net_banking': 30
    }[payment.paymentMethod] ?? 25;
    const retryPenalty = Math.min((attemptNumber - 1) * 12, 36);
    const amountPressure = Number(payment.amount ?? '0') > 250000 ? 14 : 0;
    const failureChance = Math.min(75, methodBias + retryPenalty + amountPressure);
    const shouldFail = seed % 100 < failureChance;

    if (shouldFail) {
      return {
        status: 'failed',
        recoveredAmount: '0',
        failureReason: 'MOCK_PROVIDER_FAILURE'
      };
    }

    return {
      status: 'success',
      recoveredAmount: payment.amount,
      failureReason: undefined
    };
  }
}

function stableHash(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash % 100;
}
