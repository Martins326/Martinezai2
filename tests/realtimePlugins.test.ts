import test from "node:test";
import assert from "node:assert/strict";
import { executeRealtimePlugin, detectPluginCall } from "../server/realtimePlugins";

test("detectPluginCall detects weather intent when weather plugin is active", () => {
  const result = detectPluginCall("What is the weather in Tokyo today?", ["weather", "calculator"]);
  assert.ok(result);
  assert.equal(result.pluginId, "weather");
  assert.equal(result.action, "get_weather");
  assert.ok(result.request.location);
});

test("detectPluginCall ignores weather query if weather plugin is not active", () => {
  const result = detectPluginCall("What is the weather in Tokyo today?", ["calculator"]);
  assert.equal(result, null);
});

test("detectPluginCall detects calculator math expression", () => {
  const result = detectPluginCall("calculate 25 * 4 + 100", ["calculator"]);
  assert.ok(result);
  assert.equal(result.pluginId, "calculator");
  assert.equal(result.action, "calculate");
  assert.equal(result.request.expression, "25 * 4 + 100");
});

test("detectPluginCall detects crypto market quotes", () => {
  const result = detectPluginCall("What is the current price of Bitcoin?", ["market"]);
  assert.ok(result);
  assert.equal(result.pluginId, "market");
  assert.equal(result.action, "get_market_quote");
  assert.equal(result.request.symbol, "bitcoin");
});

test("detectPluginCall detects world clock timezone queries", () => {
  const result = detectPluginCall("what time is it in London right now?", ["world-clock"]);
  assert.ok(result);
  assert.equal(result.pluginId, "world-clock");
  assert.equal(result.action, "get_current_time");
  assert.ok(result.request.location);
});

test("detectPluginCall supports explicit @plugin mentions", () => {
  const result = detectPluginCall("@weather Paris", ["weather"]);
  assert.ok(result);
  assert.equal(result.pluginId, "weather");
  assert.equal(result.request.location, "paris");
});

test("executeRealtimePlugin executes calculator expressions accurately", async () => {
  const result = await executeRealtimePlugin("calculator", "calculate", { expression: "(10 * 5) + 25" });
  assert.equal(result.success, true);
  assert.equal(result.result, 75);
});

test("executeRealtimePlugin executes world-clock accurately", async () => {
  const result = await executeRealtimePlugin("world-clock", "get_current_time", { location: "Tokyo" });
  assert.ok(result.local_time);
  assert.equal(result.timezone, "Asia/Tokyo");
});
