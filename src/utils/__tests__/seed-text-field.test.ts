/// <reference types="jest" />

import type { TextFieldRef } from "@expo/ui/jetpack-compose";
import type { RefObject } from "react";

import { seedTextField } from "@/utils/seed-text-field";

/** Builds a fake ref whose setText is a jest mock. */
const makeRef = (setText: jest.Mock) =>
  ({ current: { setText } }) as unknown as RefObject<TextFieldRef | null>;

describe("seedTextField", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("sets the value once when the ref is ready", async () => {
    const setText = jest.fn().mockResolvedValue(undefined);
    await seedTextField(makeRef(setText), "hello");
    expect(setText).toHaveBeenCalledTimes(1);
    expect(setText).toHaveBeenCalledWith("hello");
  });

  it("retries when setText rejects and stops once it succeeds", async () => {
    const setText = jest
      .fn()
      .mockRejectedValueOnce(new Error("not registered"))
      .mockRejectedValueOnce(new Error("not registered"))
      .mockResolvedValueOnce(undefined);

    const promise = seedTextField(makeRef(setText), "retry me");
    await jest.advanceTimersByTimeAsync(500);
    await promise;

    expect(setText).toHaveBeenCalledTimes(3);
    expect(setText).toHaveBeenLastCalledWith("retry me");
  });

  it("gives up after the given number of attempts", async () => {
    const setText = jest.fn().mockRejectedValue(new Error("never ready"));

    const promise = seedTextField(makeRef(setText), "x", 3);
    await jest.advanceTimersByTimeAsync(1_000);
    await promise;

    expect(setText).toHaveBeenCalledTimes(3);
  });

  it("does nothing but wait when the ref is null", async () => {
    const ref = { current: null } as RefObject<TextFieldRef | null>;

    const promise = seedTextField(ref, "nope", 2);
    await jest.advanceTimersByTimeAsync(200);
    await expect(promise).resolves.toBeUndefined();
  });
});
