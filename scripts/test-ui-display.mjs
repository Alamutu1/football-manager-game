// UI Phase 1 display-helper tests. Pure logic only: avatar initials,
// position colours, and role key attributes. Run after compiling the
// game core to /tmp/fm-core (see the core test command).
import assert from 'node:assert';

import { initialsFor, positionColorFor, splitDisplayName } from '/tmp/fm-core/player-display.js';
import { keyAttributesFor } from '/tmp/fm-core/ratings.js';

let n = 0;
const check = (label, actual, expected) => {
  n += 1;
  assert.deepStrictEqual(actual, expected, label);
  console.log(`ok ${n} - ${label}`);
};

check('initials first+last', initialsFor('Bukayo', 'Saka'), 'BS');
check('initials hyphenated last name', initialsFor('Bayli', 'Spencer-Adams'), 'BS');
check('initials single name', initialsFor('Ada', ''), 'AD');
check('initials empty', initialsFor('', ''), '?');
check('initials deterministic', initialsFor('Bukayo', 'Saka'), initialsFor('Bukayo', 'Saka'));
check('split full name', splitDisplayName('Bukayo Saka'), { first: 'Bukayo', last: 'Saka' });
check('split single name', splitDisplayName('Kevin'), { first: 'Kevin', last: '' });
check('split multi-word name takes last word', splitDisplayName('Marnon Busch'), { first: 'Marnon', last: 'Busch' });

check('position colour GK', positionColorFor('GK'), '#F5B81D');
check('position colour DF', positionColorFor('DF'), '#2FA84F');
check('position colour MF', positionColorFor('MF'), '#4DA3FF');
check('position colour FW', positionColorFor('FW'), '#FF7A1A');
check(
  'position colours distinct',
  new Set(['GK', 'DF', 'MF', 'FW'].map(positionColorFor)).size,
  4,
);

check('ST top key attribute is shooting', keyAttributesFor('ST')[0], 'shooting');
check('GK top key attribute is goalkeeping', keyAttributesFor('GK')[0], 'goalkeeping');
for (const role of ['GK', 'CB', 'FB', 'WB', 'DM', 'CM', 'AM', 'W', 'ST', 'SS']) {
  check(`key attributes for ${role} has 3 entries`, keyAttributesFor(role).length, 3);
}
check('W key attributes include pace and dribbling', keyAttributesFor('W').includes('pace') && keyAttributesFor('W').includes('dribbling'), true);

console.log(`UI display tests: ${n}/${n} passed`);
