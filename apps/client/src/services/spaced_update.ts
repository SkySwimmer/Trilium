type Callback = () => Promise<void> | void;

export default class SpacedUpdate {
    private updater: Callback;
    private updateRunner: Promise<void> | undefined;
    private lastUpdated: number;
    private changed: boolean;
    private requireRefresh: boolean;
    private busyUpdating: boolean;
    private updateInterval: number;
    private changeForbidden?: boolean;

    constructor(updater: Callback, updateInterval = 1000) {
        this.updater = updater;
        this.updateRunner = undefined;
        this.lastUpdated = Date.now();
        this.requireRefresh = false;
        this.busyUpdating = false;
        this.changed = false;
        this.updateInterval = updateInterval;
    }

    scheduleUpdate() {
        if (!this.changeForbidden) {
            this.changed = true;
            setTimeout(() => this.triggerUpdate());
        }
    }

    async updateNowIfNecessary() {
        if (this.changed) {
            this.changed = false; // optimistic...

            try {
                if (this.isBusyUpdating())
                    await this.updateRunner;
                await this.updater();
            } catch (e) {
                this.changed = true;
                this.requireRefresh = true;

                throw e;
            }
        }
    }

    isBusyUpdating() {
        return this.busyUpdating;
    }

    getUpdaterPromise() {
        return this.updateRunner;
    }

    isAllSavedAndTriggerUpdate() {
        const allSaved = !this.changed && !this.busyUpdating && !this.requireRefresh;

        this.updateNowIfNecessary();

        return allSaved;
    }

    /**
     * Normally {@link scheduleUpdate()} would actually trigger the update only once per {@link updateInterval}. If the method is called 200 times within 20s, it will execute only 20 times.
     * Sometimes, if the updates are continuous this would cause a performance impact. Resetting the time ensures that the calls to {@link triggerUpdate} have stopped before actually triggering an update.
     */
    resetUpdateTimer() {
        this.lastUpdated = Date.now();
        this.requireRefresh = true;
    }

    /**
     * Sets the update interval for the spaced update.
     * @param interval The update interval in milliseconds.
     */
    setUpdateInterval(interval: number) {
        this.updateInterval = interval;
    }

    triggerUpdate() {
        if (!this.changed) {
            return;
        }

        if (Date.now() - this.lastUpdated > this.updateInterval) {
            // Check update
            if (this.busyUpdating) {
                // Require refresh
                this.requireRefresh = true;
                this.lastUpdated = Date.now();
                this.changed = false;
                return;
            } else {
                // Run updater
                this.lastUpdated = Date.now();
                this.changed = false;
                this.requireRefresh = false;
                this.runUpdate();
                return;
            }
        } else {
            // update isn't triggered but changes are still pending, so we need to schedule another check
            this.scheduleUpdate();
        }
    }

    private runUpdate() {
        this.busyUpdating = true;
        this.updateRunner = new Promise((resolve, reject) => {
            this.runUpdateInner();
            resolve();
            this.updateRunner = undefined;
        });
    }

    private runUpdateInner() {
        const prom = this.updater();
        if (prom && prom instanceof Promise) {
            // Its a promise, wait for it to finish
            prom.then(() => { 
                // Done
                // Check if another refresh is needed
                if (this.requireRefresh) { 
                    // Run the updater again
                    this.requireRefresh = false;
                    this.runUpdate();
                } else {
                    // Done
                    this.busyUpdating = false;
                }
            });
        } else {
            // Done
            // Check if another refresh is needed
            if (this.requireRefresh) { 
                // Run the updater again
                this.requireRefresh = false;
                this.runUpdate();
            } else {
                // Done
                this.busyUpdating = false;
            }
        }
    }

    async allowUpdateWithoutChange(callback: Callback) {
        this.changeForbidden = true;

        try {
            await callback();
        } finally {
            this.changeForbidden = false;
        }
    }
}
