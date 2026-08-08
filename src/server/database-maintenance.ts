class DatabaseMaintenanceCoordinator {
    private gate: Promise<void> | null = null;
    private resume: (() => void) | null = null;
    private inFlight = new Set<Promise<unknown>>();
    private maintenanceQueue: Promise<unknown> | null = null;
    private maintenanceCount = 0;

    async run<T>(operation: () => Promise<T> | T): Promise<T> {
        while (this.gate) {
            await this.gate;
        }

        const pending = Promise.resolve().then(operation);
        this.inFlight.add(pending);
        try {
            return await pending;
        } finally {
            this.inFlight.delete(pending);
        }
    }

    maintain<T>(operation: () => Promise<T> | T): Promise<T> {
        const previous = this.maintenanceQueue;
        this.maintenanceCount++;
        if (!this.gate) {
            this.gate = new Promise((resolve) => {
                this.resume = resolve;
            });
        }

        const run = async () => {
            if (this.inFlight.size) {
                await Promise.allSettled([...this.inFlight]);
            }
            return operation();
        };
        const pending = previous ? previous.then(run) : run();
        this.maintenanceQueue = pending.catch(() => {});
        return pending.finally(() => {
            this.maintenanceCount--;
            if (this.maintenanceCount === 0) {
                this.maintenanceQueue = null;
                this.gate = null;
                this.resume?.();
                this.resume = null;
            }
        });
    }
}

export { DatabaseMaintenanceCoordinator };
