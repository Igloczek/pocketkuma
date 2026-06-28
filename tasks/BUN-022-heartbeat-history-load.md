# BUN-022: Heartbeat History Load Cost

## Objective

Determine whether login and reconnect send too much heartbeat history, and reduce the load if it creates measurable memory or payload cost.

## Context

After login, `afterLogin()` sends monitor data and heartbeat history. For small setups this may be acceptable, but it can become unnecessary work as monitor count or history grows.

## Scope

- Measure `sendHeartbeatList()` and `sendImportantHeartbeatList()`.
- Record how many heartbeat rows are sent after login for 20 monitors.
- Check whether the frontend needs history for all monitors immediately.
- If the cost is meaningful, implement lazy loading or restrict history to the viewed monitor.

## Out of Scope

- Changing the heartbeat table schema.
- Deleting heartbeat history.
- Redesigning charts unless required by the loading change.

## Suggested Implementation

1. Add debug measurement for:
   - query count;
   - row count;
   - query time;
   - JSON payload size.
2. Run the 20-monitor scenario.
3. Inspect `src/mixins/socket.js` and views consuming `heartbeatList`.
4. If implementing lazy loading:
   - send only monitor metadata at login;
   - request heartbeat history when details view needs it;
   - preserve compatible events where practical.
5. Add a socket/client test or focused E2E for the details page.

## Files to Inspect

- `server/client.js`
- `server/server.js`
- `src/mixins/socket.js`
- `src/pages/Details.vue`
- `test/e2e/`

## Validation

```bash
npm run test-backend
npm run build
npm run test-e2e -- --grep "dashboard|details"
```

Also save before/after payload measurements.

## Acceptance Criteria

- There is a measurement for the current behavior.
- If the cost is low, the decision to keep current behavior is documented with numbers.
- If the cost is high, history is lazy-loaded or limited.
- Dashboard and details still show heartbeat history correctly.
- Client reconnect does not cause permanent RSS growth in the benchmark.

## Completion Evidence

Report the number of heartbeat rows sent after login before/after and the UI test result.
