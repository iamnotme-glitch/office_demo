export type LineItem = {
  quantity: number;
  rate: number;
};

export type VehicleRate = {
  vehicles: number;
  rate_per_vehicle: number;
};

export type DemurrageEntry = {
  vehicles: number;
  rate: number;
  days: number;
};

export class FinanceService {
  /**
   * Calculates the total for a single line item.
   * Precision: 2 decimal places.
   */
  static calculateLineItem(item: LineItem): number {
    return Math.round(item.quantity * item.rate * 100) / 100;
  }

  /**
   * Calculates the total for a vehicle rate segment.
   */
  static calculateVehicleRate(segment: VehicleRate): number {
    return Math.round(segment.vehicles * segment.rate_per_vehicle * 100) / 100;
  }

  /**
   * Calculates the total for a demurrage entry.
   */
  static calculateDemurrage(entry: DemurrageEntry): number {
    return Math.round(entry.vehicles * entry.rate * entry.days * 100) / 100;
  }

  /**
   * Aggregates all components of an invoice into a grand total.
   */
  static calculateGrandTotal(
    items: LineItem[],
    vehicleRates: VehicleRate[],
    demurrageEntries: DemurrageEntry[]
  ): number {
    const itemsTotal = items.reduce((sum, item) => sum + this.calculateLineItem(item), 0);
    const ratesTotal = vehicleRates.reduce((sum, rate) => sum + this.calculateVehicleRate(rate), 0);
    const demurrageTotal = demurrageEntries.reduce((sum, dem) => sum + this.calculateDemurrage(dem), 0);

    return Math.round((itemsTotal + ratesTotal + demurrageTotal) * 100) / 100;
  }

  /**
   * Formats a number as a currency string (BDT).
   */
  static formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-BD', {
      style: 'currency',
      currency: 'BDT',
      minimumFractionDigits: 2,
    }).format(amount).replace('BDT', '৳');
  }
}
