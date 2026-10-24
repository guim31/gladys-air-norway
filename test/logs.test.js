// -----------------------------------------------------------------------------
// Quiet logs: a normal cycle writes nothing at the info level, and a failure
// that lasts writes one line when it starts and one when it ends.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HOUR, createAll, createWorld, discovered } from './helpers/world.js';
import { ALNABRU } from './helpers/network.js';

/** Capture the log lines (the SDK logger writes through console) at a level. */
function capture(t, level) {
  const previous = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = level;
  t.after(() => {
    process.env.LOG_LEVEL = previous;
  });
  const lines = [];
  for (const stream of ['log', 'error']) {
    t.mock.method(console, stream, (...args) => lines.push(args.join(' ')));
  }
  return lines;
}

test('a normal day writes nothing at the info level', async (t) => {
  const lines = capture(t, 'info');
  const w = await createWorld({ config: { stations: ALNABRU } });
  await createAll(w);
  // Start-up says what it follows and what it found: lifecycle.
  assert.ok(
    lines.some(
      (line) => line.includes('[INFO]') && line.includes('MET Norway Hjemme: forecast found'),
    ),
    lines.join('\n'),
  );
  const before = lines.length;
  for (let i = 0; i < 24 * 4; i += 1) {
    w.advance(HOUR / 4);
    await w.app.poller.cycle();
    await w.gladys.fake.widgetGet('air_quality', { language: 'fr' });
    await w.gladys.fake.poll(discovered(w, 'house:hjemme'));
    await w.gladys.fake.sceneAction('get_air_quality', {});
  }
  assert.deepEqual(lines.slice(before), []);
});

test('a lasting failure: one line when it starts, one when it ends', async (t) => {
  const lines = capture(t, 'info');
  const w = await createWorld({ config: { stations: ALNABRU } });
  await createAll(w);
  const before = lines.length;
  w.network.down = true;
  for (let i = 0; i < 6; i += 1) {
    w.advance(HOUR);
    await w.app.poller.cycle();
  }
  w.network.down = false;
  w.advance(HOUR);
  await w.app.poller.cycle();
  const logged = lines.slice(before);
  assert.equal(logged.filter((line) => line.includes('unreachable')).length, 1, logged.join('\n'));
  assert.equal(logged.filter((line) => line.includes('answers again')).length, 1);
  assert.equal(logged.length, 2, logged.join('\n'));
});
