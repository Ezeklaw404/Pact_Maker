import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { newCampaign } from '../defaults';
import { reduce } from '../reducer';
import { viewFor } from '../view';
import { PlayerScreen } from './PlayerScreen';

function make() {
  let c = newCampaign('T', true);
  c = reduce(c, { type: 'addPlayer', name: 'Goblin King', gmOnly: true });
  return c;
}
const noop = () => {};

describe('PlayerScreen', () => {
  it('shows my sheet and the party, never the monster', () => {
    const c = make();
    const html = renderToString(
      <PlayerScreen view={viewFor(c, c.players[0].id)} permission="view" notice="" onAward={noop} />,
    );
    expect(html).toContain('Player 1');
    expect(html).toContain('Player 2');
    expect(html).not.toContain('Goblin King');
  });

  it('shows +1 buttons only with permission', () => {
    const c = make();
    const v = viewFor(c, c.players[0].id);
    const viewOnly = renderToString(<PlayerScreen view={v} permission="view" notice="" onAward={noop} />);
    const canXp = renderToString(<PlayerScreen view={v} permission="xp" notice="" onAward={noop} />);
    expect(viewOnly).not.toContain('>+1<');
    expect(canXp).toContain('>+1<');
  });

  it('tells an unassigned player to ask the host', () => {
    const c = make();
    const html = renderToString(<PlayerScreen view={viewFor(c, null)} permission="view" notice="" onAward={noop} />);
    expect(html).toContain('Ask the host');
    expect(html).not.toContain('Goblin King');
  });
});
