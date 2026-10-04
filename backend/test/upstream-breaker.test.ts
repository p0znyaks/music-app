import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { UpstreamBreaker } from "../src/services/upstream-breaker";

describe("UpstreamBreaker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stays closed while calls are succeeding", () => {
    const b = new UpstreamBreaker("test", 3, 1000);
    for (let i = 0; i < 10; i += 1) {
      b.onSuccess();
    }
    expect(b.isOpen()).toBe(false);
  });

  it("stays closed below the failure threshold", () => {
    const b = new UpstreamBreaker("test", 3, 1000);
    b.onFailure("a");
    b.onFailure("b");
    expect(b.isOpen()).toBe(false);
  });

  it("opens once the threshold is reached", () => {
    const b = new UpstreamBreaker("test", 3, 1000);
    b.onFailure("a");
    b.onFailure("b");
    b.onFailure("c");
    expect(b.isOpen()).toBe(true);
  });

  it("reports open state for introspection", () => {
    const b = new UpstreamBreaker("test", 2, 1000);
    expect(b.state).toBe("closed");
    b.onFailure("a");
    b.onFailure("b");
    expect(b.state).toBe("open");
  });

  it("closes again after a success while open", () => {
    const b = new UpstreamBreaker("test", 2, 1000);
    b.onFailure("a");
    b.onFailure("b");
    expect(b.isOpen()).toBe(true);
    b.onSuccess();
    expect(b.isOpen()).toBe(false);
  });

  it("a single success resets the consecutive failure counter", () => {
    const b = new UpstreamBreaker("test", 3, 1000);
    b.onFailure("a");
    b.onFailure("b");
    b.onSuccess();
    b.onFailure("c");
    b.onFailure("d");
    // Two fresh failures must not accumulate with the earlier two.
    expect(b.isOpen()).toBe(false);
  });

  it("allows a probe again once the cooldown elapses", () => {
    const b = new UpstreamBreaker("test", 1, 1000);
    b.onFailure("down");
    expect(b.isOpen()).toBe(true);
    vi.advanceTimersByTime(1001);
    expect(b.isOpen()).toBe(false);
  });

  it("reopens if the probe after cooldown also fails", () => {
    const b = new UpstreamBreaker("test", 1, 1000);
    b.onFailure("down");
    vi.advanceTimersByTime(1001);
    expect(b.isOpen()).toBe(false);
    b.onFailure("still down");
    expect(b.isOpen()).toBe(true);
  });
});
