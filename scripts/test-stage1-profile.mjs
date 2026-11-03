/**
 * Regression tests for the Stage 1 Formation -> Profile issue.
 *
 * Bug reported on a phone: tapping a shirt on the Formation pitch,
 * then Profile, appeared to do nothing. Root cause in squad.tsx:
 * the Profile handler set expandedId and switched to the list view,
 * but never scrolled the list to that player, and the FlatList had
 * no extraData, so the expanded row was not guaranteed to re-render
 * or be visible.
 *
 * Run after compiling the game core:
 *   npx tsc src/game/*.ts --outDir /tmp/fm-core --module commonjs --target es2020 --skipLibCheck --ignoreConfig
 *   node scripts/test-stage1-profile.mjs
 * Exit code 0 = all pass, 1 = any failure.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = process.argv[2] || '/tmp/fm-core';
const require = createRequire(import.meta.url);
const { indexOfPlayer, isProfileExpanded } = require(`${OUT}/profile-navigation.js`);

const here = dirname(fileURLToPath(import.meta.url));
const squadSrc = readFileSync(join(here, '..', 'src', 'app', 'squad.tsx'), 'utf8');

let passed = 0;
let failed = 0;
function check(name, cond, detail = '') {
  if (cond) {
    passed += 1;
    console.log(`PASS ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL ${name} ${detail}`);
  }
}

// Pure helper: index lookup in the sorted list the UI scrolls to.
const players = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
check('indexOfPlayer finds first', indexOfPlayer(players, 'a') === 0);
check('indexOfPlayer finds middle', indexOfPlayer(players, 'b') === 1);
check('indexOfPlayer finds last', indexOfPlayer(players, 'c') === 2);
check('indexOfPlayer missing returns -1', indexOfPlayer(players, 'z') === -1);
check('indexOfPlayer null returns -1', indexOfPlayer(players, null) === -1);
check('indexOfPlayer empty returns -1', indexOfPlayer([], 'a') === -1);

// Pure helper: expanded-row decision, matching Squad list behaviour.
check('isProfileExpanded matches id', isProfileExpanded('b', 'b') === true);
check('isProfileExpanded rejects other id', isProfileExpanded('b', 'a') === false);
check('isProfileExpanded null expands nothing', isProfileExpanded(null, 'a') === false);

// Wiring guards: the fix must stay present in squad.tsx.
check('FlatList has extraData for expandedId', squadSrc.includes('extraData={expandedId}'));
check('FlatList has a ref for scrolling', squadSrc.includes('ref={listRef}'));
check('Profile handler computes the scroll index', squadSrc.includes('indexOfPlayer(sorted, selected.id)'));
check('Profile handler stores a pending scroll index', squadSrc.includes('pendingScrollIndexRef.current = index'));
check('Profile scroll uses scrollToIndex', squadSrc.includes('scrollToIndex'));
check('scrollToIndex failure has a fallback', squadSrc.includes('onScrollToIndexFailed'));
check('expanded row uses isProfileExpanded', squadSrc.includes('isProfileExpanded(expandedId, item.id)'));

// Boundary guards: this fix must not smuggle in tactics features.
check('no bench concept added to squad screen', !/bench/i.test(squadSrc));
check('no substitute selection added to squad screen', !/substitut/i.test(squadSrc));
check('no formation selector added to squad screen', !/formation.*selector|selector.*formation/i.test(squadSrc));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
