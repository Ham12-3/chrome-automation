export class AutomationSafetyState {
  private paused = false;
  private killed = false;

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  kill(): void {
    this.killed = true;
    this.paused = true;
  }

  getStatus(): { paused: boolean; killed: boolean } {
    return { paused: this.paused, killed: this.killed };
  }

  assertCanRun(): void {
    if (this.killed) {
      throw new Error('Automation kill switch is active. Restart the server to run automation again.');
    }
    if (this.paused) {
      throw new Error('Automation is paused. Call automation_resume before running more actions.');
    }
  }
}

export const automationSafety = new AutomationSafetyState();
