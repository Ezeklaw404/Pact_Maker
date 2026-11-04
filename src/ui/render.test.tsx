import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { newCampaign } from '../defaults';
import { reduce } from '../reducer';
import { ActionModal } from './ActionModal';
import { FocusView } from './FocusView';
import { GrantModal } from './GrantModal';
import { Menu } from './Menu';
import { PlayerCard } from './PlayerCard';

const noop = () => {};

describe('screens render without crashing', () => {
  let c = newCampaign('Smoke', true);
  c = reduce(c, { type: 'toggleCombat' });
  c = reduce(c, { type: 'setFavorite', playerId: c.players[0].id, statId: 'force' });
  c = reduce(c, { type: 'learn', playerId: c.players[0].id, abilityId: 'swordsmanship' });
  c = reduce(c, {
    type: 'award',
    playerIds: [c.players[0].id],
    targets: [{ type: 'stat', id: 'force' }],
    base: 1,
  });
  const p = c.players[0];

  it('player card shows level and combat state', () => {
    const html = renderToString(<PlayerCard c={c} p={p} selected={false} onSelect={noop} onOpen={noop} />);
    expect(html).toContain('Player 1');
    expect(html).toContain('0.60'); // 6 xp / 10 into level 0
  });

  it('focus view lists stats, skills and locked techniques', () => {
    const html = renderToString(<FocusView c={c} p={p} dispatch={noop} onBack={noop} onToast={noop} />);
    expect(html).toContain('Force');
    expect(html).toContain('Swordsmanship');
    expect(html).toContain('Fireball');
    expect(html).toContain('Force 4, Area 2, Fire 1');
  });

  it('modals and menu render', () => {
    const ids = c.players.map((x) => x.id);
    expect(renderToString(<ActionModal c={c} initialPlayers={ids} dispatch={noop} onClose={noop} />)).toContain('Perform action');
    expect(renderToString(<GrantModal c={c} initialPlayers={ids} dispatch={noop} onClose={noop} />)).toContain('Grant');
    expect(
      renderToString(
        <Menu c={c} index={[]} dispatch={noop} onOpen={noop} onCreate={noop} onRemove={noop} onImport={noop} onClose={noop} />,
      ),
    ).toContain('Campaigns');
  });
});
