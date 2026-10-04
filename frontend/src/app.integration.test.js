// Integration checks: every feature stays reachable from the app shell, and the
// Settings library behaves. The api module is mocked, so no test reaches a backend.
import { render, screen, within, fireEvent, waitFor, act } from '@testing-library/react';
import App from './App';
import { accountsApi, tradesApi, libraryApi, kpisApi, goalsApi, __restoreMocks } from './api';

jest.mock('./api', () => {
  const ok = (data) => Promise.resolve({ data });
  // CRA's jest preset resets mocks before each test, so every mock keeps its
  // implementation and __restoreMocks puts it back in beforeEach.
  const all = [];
  const fn = (impl) => { const f = jest.fn(impl); f.impl = impl; all.push(f); return f; };
  const TRADE = {
    id: 101, account_id: 1, trade_group: '9/10/26_TSLA_STOCK_1', date: '2026-09-10', ticker: 'TSLA',
    instrument_type: 'STOCK', side: 'LONG', gross_pnl: 195, net_pnl: 193.45, commissions: 1.55,
    executions: [
      { date: '2026-09-10', time: '09:54:10', action: 'BOT', qty: 200, price: 366.09, commission: 0 },
      { date: '2026-09-10', time: '10:08:24', action: 'SOLD', qty: 200, price: 367.07, commission: 1.55 },
    ],
    setup: 'VWAP Reclaim', setup_grade: 'B', setup_notes: null, setup_source: 'manual',
    mfe_pct: 0.85, mae_pct: -0.27, exit_efficiency: 31.25, strategy: 'Test Strategy', r_multiple: 0.41,
  };
  const TRADE_2 = { ...TRADE, id: 102, trade_group: '9/10/26_META_STOCK_1', ticker: 'META', net_pnl: -50 };
  // 300 bought, 100 sold: 200 still open.
  const OPEN_TRADE = {
    id: 103, account_id: 1, trade_group: '9/09/26_GOOG_STOCK_1', date: '2026-09-09', ticker: 'GOOG',
    instrument_type: 'STOCK', side: 'LONG', net_pnl: null, gross_pnl: null, commissions: 0,
    executions: [
      { date: '2026-09-09', time: '09:40:00', action: 'BOT', qty: 300, price: 100, commission: 0 },
      { date: '2026-09-09', time: '11:00:00', action: 'SOLD', qty: 100, price: 105, commission: 0 },
    ],
  };
  const ACCOUNTS = [
    { id: 1, name: 'Day Trading', type: 'day_trading', color: '#6366f1', broker: 'Schwab' },
    { id: 2, name: 'Swing', type: 'swing', color: '#6366f1', broker: 'Schwab' },
  ];
  const LIBRARY = {
    strategies: [
      { name: 'VWAP Cross', description: 'Reclaim of VWAP', trades: 10, aliases: [], },
      { name: 'Continuation RS', description: null, trades: 2, aliases: [], },
    ],
    sources: [
      { name: 'Scanner', description: null, trades: 8, aliases: [] },
      { name: 'OneOption', description: null, trades: 1, aliases: [] },
    ],
    tags: {
      mistake: [{ name: 'Sized too big', description: null, trades: 6, aliases: [] }],
      execution: [{ name: 'Scaled out', description: null, trades: 20, aliases: [] }],
      setup: [], emotion: [], outcome: [],
    },
    tag_types: ['setup', 'execution', 'mistake', 'emotion', 'outcome'],
  };
  // Anything not listed resolves with an empty object, which every page treats as "no data".
  const withDefault = (methods) => new Proxy(methods, {
    get: (target, key) => (key in target ? target[key] : fn(() => ok({}))),
  });
  return {
    __restoreMocks: () => all.forEach(f => f.mockImplementation(f.impl)),
    API_BASE: 'http://mocked.invalid',
    accountsApi: withDefault({
      list: fn(() => ok(ACCOUNTS)),
      create: fn(() => ok({ id: 3 })),
      update: fn(() => ok({})),
    }),
    tradesApi: withDefault({
      list: fn((params = {}) => ok(params.open_only ? [OPEN_TRADE] : [TRADE, TRADE_2])),
      addExecution: fn(() => ok({})),
      updateExecution: fn(() => ok(TRADE)),
      getAnalysis: fn(() => ok(null)),
      getAnalysisOptions: fn(() => ok({ strategies: [], idea_sources: [] })),
      listCustomSetups: fn(() => ok([])),
    }),
    kpisApi: withDefault({ get: fn(() => ok({ total_net_pnl: 100, daily_pnl: [], by_strategy: [] })) }),
    importApi: withDefault({}),
    diaryApi: withDefault({ list: fn(() => ok([])) }),
    chartApi: withDefault({ get: fn(() => ok({ bars: [], warning: 'No chart data in tests' })) }),
    insightsApi: withDefault({}),
    calendarApi: withDefault({ get: fn(() => ok({ days: [] })) }),
    brainApi: withDefault({}),
    dailySummaryApi: withDefault({ get: fn(() => ok({ trades: [] })) }),
    syncApi: withDefault({}),
    goalsApi: withDefault({ get: fn(() => ok({ win_rate: 65 })), put: fn(() => ok({ win_rate: 65 })) }),
    reportsApi: withDefault({ get: fn(() => Promise.reject(new Error('no reports in tests'))) }),
    edgeReportApi: withDefault({}),
    weeklySummaryApi: withDefault({}),
    yearlyKpisApi: withDefault({ get: fn(() => ok({ months: [] })) }),
    libraryApi: withDefault({
      list: fn(() => ok(LIBRARY)),
      merge: fn(() => ok({ moved: 2, target: 'VWAP Cross', trades: 12 })),
      remove: fn(() => ok({ affected: 1, reassigned_to: null })),
      update: fn(() => ok({ name: 'VWAP Cross', trades: 10 })),
      create: fn(() => ok({ name: 'New' })),
    }),
  };
});

beforeAll(() => {
  // jsdom gaps that charts and menus touch.
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  Element.prototype.scrollIntoView = jest.fn();
  window.alert = jest.fn();
});

beforeEach(() => __restoreMocks());

async function renderApp() {
  render(<App />);
  // Accounts load on mount; waiting for them lets the first render settle.
  await waitFor(() => expect(accountsApi.list).toHaveBeenCalled());
  await act(async () => {});
}

const nav = () => screen.getByRole('navigation', { name: 'Main' });

test('header keeps every page, Settings, Import, Add Trade and a labeled Brain entry visible', async () => {
  await renderApp();
  for (const label of ['Dashboard', 'Trade View', 'Calendar', 'Day Review', 'Reports', 'Diary', 'Help', 'Settings']) {
    expect(within(nav()).getByRole('button', { name: label })).toBeVisible();
  }
  const banner = screen.getByRole('banner');
  expect(within(banner).getByRole('button', { name: /^Import$/ })).toBeVisible();
  expect(within(banner).getByRole('button', { name: /Add Trade/ })).toBeVisible();
  expect(within(banner).getByRole('button', { name: /Brain/ })).toBeVisible();
});

test('Brain opens from the header as a dialog and closes on Escape', async () => {
  await renderApp();
  const trigger = within(screen.getByRole('banner')).getByRole('button', { name: /Brain/ });
  fireEvent.click(trigger);
  const dialog = await screen.findByRole('dialog', { name: /Brain/i });
  expect(dialog).toBeVisible();
  fireEvent.keyDown(dialog, { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('dialog', { name: /Brain/i })).not.toBeInTheDocument());
});

test('account menu keeps selection, rename and new-account controls', async () => {
  await renderApp();
  fireEvent.click(screen.getByRole('button', { name: 'Account: All Accounts' }));
  const menu = screen.getByRole('menu', { name: 'Accounts' });
  expect(within(menu).getByRole('menuitemradio', { name: 'All Accounts' })).toBeInTheDocument();
  expect(within(menu).getByRole('menuitemradio', { name: /Day Trading/ })).toBeInTheDocument();
  expect(within(menu).getByRole('button', { name: /New Account/ })).toBeInTheDocument();

  fireEvent.click(within(menu).getByRole('button', { name: 'Rename Day Trading' }));
  const input = within(menu).getByRole('textbox', { name: 'New name for Day Trading' });
  fireEvent.change(input, { target: { value: 'Day Trading Main' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  await waitFor(() => expect(accountsApi.update).toHaveBeenCalledWith(1, { name: 'Day Trading Main' }));
});

test('choosing an account updates the shared header state', async () => {
  await renderApp();
  fireEvent.click(screen.getByRole('button', { name: 'Account: All Accounts' }));
  fireEvent.click(screen.getByRole('menuitemradio', { name: /Swing/ }));
  expect(await screen.findByRole('button', { name: 'Account: Swing' })).toBeInTheDocument();
});

test('Add Trade opens a modal dialog that closes on Escape', async () => {
  await renderApp();
  fireEvent.click(within(screen.getByRole('banner')).getByRole('button', { name: /Add Trade/ }));
  const dialog = await screen.findByRole('dialog', { name: /Add Trade/ });
  expect(within(dialog).getByRole('button', { name: /Save Trade/ })).toBeInTheDocument();
  fireEvent.keyDown(dialog, { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('dialog', { name: /Add Trade/ })).not.toBeInTheDocument());
});

test('Reports keeps its tabs, adds Sources & Tags, and supports arrow-key navigation', async () => {
  await renderApp();
  fireEvent.click(within(nav()).getByRole('button', { name: 'Reports' }));
  const tablist = await screen.findByRole('tablist');
  const names = within(tablist).getAllByRole('tab').map(t => t.textContent.trim());
  expect(names).toEqual(['Overview', 'Setups & Strategy', 'Sources & Tags', 'Timing', 'Execution', 'Symbols', 'Psychology']);
  const overview = within(tablist).getByRole('tab', { name: 'Overview' });
  expect(overview).toHaveAttribute('aria-selected', 'true');
  fireEvent.keyDown(overview, { key: 'ArrowRight' });
  expect(within(tablist).getByRole('tab', { name: 'Setups & Strategy' })).toHaveAttribute('aria-selected', 'true');
});

test('Trade View opens Trade Details with all five tabs, back and previous/next', async () => {
  await renderApp();
  fireEvent.click(within(nav()).getByRole('button', { name: 'Trade View' }));
  await waitFor(() => expect(tradesApi.list).toHaveBeenCalled());
  // A row opens the trade. The in-place expand was removed in V3.
  const row = (await screen.findAllByText('TSLA'))[0].closest('tr');
  fireEvent.click(row);

  const tablist = await screen.findByRole('tablist', { name: 'Trade review sections' });
  const names = within(tablist).getAllByRole('tab').map(t => t.textContent.trim());
  expect(names).toEqual(['Stats', 'Strategy', 'Tags', 'Executions', 'What If']);
  expect(screen.getByRole('button', { name: /Back to trades/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Previous trade/ })).toBeDisabled();
  expect(screen.getByRole('button', { name: /Next trade/ })).toBeEnabled();
  // Trade View stays highlighted while a trade is open.
  expect(within(nav()).getByRole('button', { name: 'Trade View' })).toHaveAttribute('aria-current', 'page');

  fireEvent.click(within(tablist).getByRole('tab', { name: 'Executions' }));
  expect(screen.getByRole('button', { name: /Add Execution/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Edit execution 1' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Delete execution 1' })).toBeInTheDocument();
});

async function openExecutionsTab(ticker = 'TSLA') {
  await renderApp();
  fireEvent.click(within(nav()).getByRole('button', { name: 'Trade View' }));
  const row = (await screen.findAllByText(ticker))[0].closest('tr');
  fireEvent.click(row);
  const tablist = await screen.findByRole('tablist', { name: 'Trade review sections' });
  fireEvent.click(within(tablist).getByRole('tab', { name: 'Executions' }));
  return tablist;
}

test('An execution price is corrected where it is shown, without opening a panel', async () => {
  await openExecutionsTab();

  // The exit fill is the second one, so its price is the exit price of the trade.
  fireEvent.click(screen.getByRole('button', { name: 'Edit price of execution 2' }));
  const input = screen.getByLabelText('Price of execution 2');
  expect(input).toHaveValue(367.07);

  fireEvent.change(input, { target: { value: '370.50' } });
  await act(async () => { fireEvent.keyDown(input, { key: 'Enter' }); });

  expect(tradesApi.updateExecution).toHaveBeenCalledWith(101, 1, expect.objectContaining({
    action: 'SOLD', qty: 200, price: 370.5,
  }));
});

test('Leaving a price untouched does not send a request', async () => {
  await openExecutionsTab();

  fireEvent.click(screen.getByRole('button', { name: 'Edit price of execution 1' }));
  const input = screen.getByLabelText('Price of execution 1');
  await act(async () => { fireEvent.keyDown(input, { key: 'Enter' }); });

  expect(tradesApi.updateExecution).not.toHaveBeenCalled();
});

test('Escape abandons a price edit', async () => {
  await openExecutionsTab();

  fireEvent.click(screen.getByRole('button', { name: 'Edit price of execution 2' }));
  const input = screen.getByLabelText('Price of execution 2');
  fireEvent.change(input, { target: { value: '999' } });
  await act(async () => { fireEvent.keyDown(input, { key: 'Escape' }); });

  expect(screen.queryByLabelText('Price of execution 2')).not.toBeInTheDocument();
  expect(tradesApi.updateExecution).not.toHaveBeenCalled();
  // Back to the price the fill actually has.
  expect(screen.getByRole('button', { name: 'Edit price of execution 2' })).toHaveTextContent('$367.07');
});

test('The avg exit shown in the KPIs jumps to the exit price to correct it', async () => {
  await renderApp();
  fireEvent.click(within(nav()).getByRole('button', { name: 'Trade View' }));
  const row = (await screen.findAllByText('TSLA'))[0].closest('tr');
  fireEvent.click(row);

  // An average is not itself editable, so it hands over to the fill underneath it. The average
  // shows in the KPI strip and again in the Stats tab; either one lands on the same fill.
  const averages = await screen.findAllByTitle('Edit the exit price in Executions');
  expect(averages.length).toBeGreaterThan(0);
  fireEvent.click(averages[0]);
  expect(await screen.findByLabelText('Price of execution 2')).toHaveValue(367.07);
});

test('An open trade offers to record the exit price it has none of', async () => {
  // A trade with no exit fill at all, so there is nothing to correct and something to record.
  const FLAT_OPEN = {
    id: 104, account_id: 1, trade_group: '9/11/26_AMZN_STOCK_1', date: '2026-09-11', ticker: 'AMZN',
    instrument_type: 'STOCK', side: 'LONG', net_pnl: null, gross_pnl: null, commissions: 0,
    executions: [{ date: '2026-09-11', time: '10:00:00', action: 'BOT', qty: 150, price: 180, commission: 0 }],
  };
  tradesApi.list.mockImplementation((params = {}) =>
    Promise.resolve({ data: params.open_only ? [FLAT_OPEN] : [FLAT_OPEN] }));

  await renderApp();
  fireEvent.click(within(nav()).getByRole('button', { name: 'Trade View' }));
  const row = (await screen.findAllByText('AMZN'))[0].closest('tr');
  fireEvent.click(row);
  const tablist = await screen.findByRole('tablist', { name: 'Trade review sections' });
  fireEvent.click(within(tablist).getByRole('tab', { name: 'Executions' }));

  const record = screen.getByRole('button', { name: /Record exit price/ });
  fireEvent.click(record);

  // Prefilled with the opposite action at the size of the position, so it closes the whole thing.
  expect(screen.getByLabelText('New execution action')).toHaveValue('SOLD');
  expect(screen.getByLabelText('New execution qty')).toHaveValue(150);
});

test('Import keeps broker CSV import and diary analysis, with keyboard dropzones', async () => {
  await renderApp();
  fireEvent.click(within(screen.getByRole('banner')).getByRole('button', { name: /^Import$/ }));
  expect(await screen.findByRole('heading', { name: /Import Broker CSV/ })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: /Analyze Trading Diary/ })).toBeInTheDocument();
  // Both supported brokers stay selectable, with auto-detect as the default.
  const broker = screen.getByLabelText('Broker');
  expect(broker).toHaveValue('auto');
  expect(within(broker).getByRole('option', { name: /Interactive Brokers/ })).toBeInTheDocument();
  expect(within(broker).getByRole('option', { name: /Thinkorswim/ })).toBeInTheDocument();
  const dropzones = screen.getAllByRole('button', { name: /Press Enter to browse/ });
  expect(dropzones).toHaveLength(2);
  dropzones.forEach(z => expect(z).toHaveAttribute('tabindex', '0'));
});

test('Help lists the metric reference and the feature guide', async () => {
  await renderApp();
  fireEvent.click(within(nav()).getByRole('button', { name: 'Help' }));
  expect(await screen.findByRole('heading', { name: 'Help and Reference' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Dashboard KPIs' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Features' })).toBeInTheDocument();
});

test('Calendar keeps the Month and Year views', async () => {
  await renderApp();
  fireEvent.click(within(nav()).getByRole('button', { name: 'Calendar' }));
  expect(await screen.findByRole('button', { name: 'Month' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Year' })).toBeInTheDocument();
});

test('Day Review keeps the loss-streak alert and its Dismiss control', async () => {
  const loss = (id, time, pnl) => ({
    id, account_id: 1, trade_group: `g${id}`, date: '2026-09-10', ticker: `L${id}`, instrument_type: 'STOCK',
    side: 'LONG', net_pnl: pnl, gross_pnl: pnl, commissions: 0,
    executions: [{ date: '2026-09-10', time, action: 'BOT', qty: 1, price: 10, commission: 0 }],
  });
  tradesApi.list.mockImplementation(() => Promise.resolve({ data: [loss(1, '09:40:00', -10), loss(2, '10:10:00', -20), loss(3, '11:00:00', -30)] }));
  await renderApp();
  fireEvent.click(within(nav()).getByRole('button', { name: 'Day Review' }));
  const alert = await screen.findByRole('alert');
  expect(alert).toHaveTextContent(/3 losses in a row/);
  fireEvent.click(within(alert).getByRole('button', { name: 'Dismiss loss-streak alert' }));
  await waitFor(() => expect(screen.queryByText(/3 losses in a row/)).not.toBeInTheDocument());
  // Previous, Next and Regenerate AI stay in the page header.
  expect(screen.getByRole('button', { name: /Previous/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Next/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Regenerate AI/ })).toBeInTheDocument();
});

test('Settings has Strategies, Sources and Tags sections, and Tags leaves out strategy and source types', async () => {
  await renderApp();
  fireEvent.click(within(nav()).getByRole('button', { name: 'Settings' }));
  const tablist = await screen.findByRole('tablist', { name: 'Settings sections' });
  expect(within(tablist).getAllByRole('tab').map(t => t.textContent.replace(/\d+/g, '').trim()))
    .toEqual(['Strategies', 'Sources', 'Tags']);
  expect(await screen.findByText('VWAP Cross')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Edit VWAP Cross' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Delete VWAP Cross' })).toBeInTheDocument();

  fireEvent.click(within(tablist).getByRole('tab', { name: /Tags/ }));
  expect(await screen.findByRole('region', { name: 'Mistakes tags' })).toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'Execution tags' })).toBeInTheDocument();
  expect(screen.queryByRole('region', { name: /Strategy tags/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('region', { name: /Source tags/ })).not.toBeInTheDocument();
});

test('Settings merges one strategy into another', async () => {
  await renderApp();
  fireEvent.click(within(nav()).getByRole('button', { name: 'Settings' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Merge Continuation RS into another strategy' }));
  fireEvent.change(screen.getByRole('combobox', { name: /Merge "Continuation RS" into/ }), { target: { value: 'VWAP Cross' } });
  fireEvent.click(screen.getByRole('button', { name: 'Merge' }));
  await waitFor(() => expect(libraryApi.merge).toHaveBeenCalledWith({
    kind: 'strategy', tag_type: '', source_name: 'Continuation RS', target_name: 'VWAP Cross',
  }));
  expect(await screen.findByRole('status')).toHaveTextContent(/2 trades moved/);
});

test('Settings delete asks to reassign and can leave trades blank', async () => {
  await renderApp();
  fireEvent.click(within(nav()).getByRole('button', { name: 'Settings' }));
  fireEvent.click(await screen.findByRole('tab', { name: /Sources/ }));
  fireEvent.click(await screen.findByRole('button', { name: 'Delete OneOption' }));
  expect(screen.getByRole('combobox', { name: /1 trade use "OneOption". Reassign them to/ })).toHaveValue('');
  fireEvent.click(screen.getAllByRole('button', { name: 'Delete' }).find(b => b.className.includes('btn-danger')));
  await waitFor(() => expect(libraryApi.remove).toHaveBeenCalledWith({
    kind: 'source', tag_type: '', name: 'OneOption', reassign_to: null,
  }));
});

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

test('Open Positions shows the remaining quantity, not the quantity entered', async () => {
  await renderApp();
  const row = (await screen.findByText('GOOG')).closest('tr');
  // 300 bought, 100 sold.
  expect(within(row).getByText('200')).toBeInTheDocument();
  expect(within(row).getByText(/of 300/)).toBeInTheDocument();
});

test('Recording an exit defaults to today, sends the entered time and fees, and refreshes', async () => {
  await renderApp();
  const row = (await screen.findByText('GOOG')).closest('tr');
  fireEvent.click(within(row).getByRole('button', { name: 'Close' }));

  const date = screen.getByLabelText('Exit date');
  expect(date).toHaveValue(todayISO());
  fireEvent.change(screen.getByLabelText('Exit time'), { target: { value: '15:45' } });
  fireEvent.change(screen.getByLabelText('Exit price'), { target: { value: '107.5' } });
  fireEvent.change(screen.getByLabelText('Fees'), { target: { value: '1.25' } });

  const callsBefore = tradesApi.list.mock.calls.length;
  fireEvent.click(screen.getByRole('button', { name: 'Record exit' }));
  await waitFor(() => expect(tradesApi.addExecution).toHaveBeenCalledWith(103, {
    action: 'SOLD', qty: 200, price: 107.5, date: todayISO(), time: '15:45:00', commission: 1.25,
  }));
  // The rest of the dashboard reloads instead of showing stale totals.
  await waitFor(() => expect(tradesApi.list.mock.calls.length).toBeGreaterThan(callsBefore));
});

test('Recording an exit refuses a date before the last fill', async () => {
  await renderApp();
  const row = (await screen.findByText('GOOG')).closest('tr');
  fireEvent.click(within(row).getByRole('button', { name: 'Close' }));
  fireEvent.change(screen.getByLabelText('Exit date'), { target: { value: '2026-09-08' } });
  fireEvent.change(screen.getByLabelText('Exit price'), { target: { value: '107.5' } });
  fireEvent.click(screen.getByRole('button', { name: 'Record exit' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/cannot be earlier than the last fill on 2026-09-09/);
  expect(tradesApi.addExecution).not.toHaveBeenCalled();
});

test('A failed dashboard load keeps the page and offers Retry', async () => {
  kpisApi.get.mockImplementation(() => Promise.reject(new Error('Network Error')));
  await renderApp();
  const alert = await screen.findByRole('alert');
  expect(alert).toHaveTextContent(/Could not load the dashboard: Network Error/);
  // The shell stays: title and the date filter are still there.
  expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  expect(within(screen.getByRole('main')).getByRole('button', { name: /All time/ })).toBeInTheDocument();

  kpisApi.get.mockImplementation(() => Promise.resolve({ data: { total_net_pnl: 100, daily_pnl: [], by_strategy: [] } }));
  fireEvent.click(within(alert).getByRole('button', { name: 'Retry' }));
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
});

test('Goals save failure is shown and keeps the panel open', async () => {
  goalsApi.put.mockImplementation(() => Promise.reject(new Error('Server error')));
  await renderApp();
  fireEvent.click(screen.getByRole('button', { name: 'Edit goals' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Save' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/Could not save goals: Server error/);
  expect(screen.getByRole('heading', { name: 'Goals' })).toBeInTheDocument();
});

// The x100 on an option contract. The backend already derives P&L with it, so these check the
// browser is not quietly dropping it from the figures it shows: 10 lots at 2.00 closed at 3.00 is
// 1000.00 of profit on 2000.00 of cost, which is 50%, not the 5000% a missing multiplier gives.
describe('an option contract is 100 shares in every figure the UI derives', () => {
  const fills = (entryPrice, exitPrice, qty) => [
    { date: '2026-09-12', time: '10:00:00', action: 'BOT', qty, price: entryPrice, commission: 0 },
    { date: '2026-09-12', time: '11:00:00', action: 'SOLD', qty, price: exitPrice, commission: 0 },
  ];

  const OPTION_TRADE = {
    id: 201, account_id: 1, trade_group: '9/12/26_SPY_OPTION_1', date: '2026-09-12', ticker: 'SPY',
    instrument_type: 'OPTION', side: 'LONG', option_type: 'CALL', option_strike: 570,
    option_expiry: '2026-10-16', gross_pnl: 1000, net_pnl: 1000, commissions: 0,
    executions: fills(2.0, 3.0, 10),
  };

  async function openStats(trade) {
    tradesApi.list.mockImplementation(() => Promise.resolve({ data: [trade] }));
    await renderApp();
    fireEvent.click(within(nav()).getByRole('button', { name: 'Trade View' }));
    const row = (await screen.findAllByText(trade.ticker))[0].closest('tr');
    fireEvent.click(row);
    const tablist = await screen.findByRole('tablist', { name: 'Trade review sections' });
    fireEvent.click(within(tablist).getByRole('tab', { name: 'Stats' }));
    return tablist;
  }

  test('ROI is 50%, not the 5000% a missing multiplier produces', async () => {
    await openStats(OPTION_TRADE);
    // Shown in the KPI strip and again in the Stats tab.
    const roi = await screen.findAllByText('+50.00%');
    expect(roi.length).toBeGreaterThan(0);
    expect(screen.queryByText('+5000.00%')).not.toBeInTheDocument();
  });

  test('Adjusted cost is 2000.00, the price times the shares behind the position', async () => {
    await openStats(OPTION_TRADE);
    // 2.00 x 10 contracts is $20 without the multiplier, and $2,000.00 with it.
    expect((await screen.findAllByText('$2,000.00')).length).toBeGreaterThan(0);
    expect(screen.queryByText('$20.00')).not.toBeInTheDocument();
  });

  test('Risk from the stop is scaled by the shares too', async () => {
    tradesApi.getAnalysis.mockImplementation(() => Promise.resolve({
      data: { analysis: { stop_loss: 1.9 }, tags: [] },
    }));
    await openStats(OPTION_TRADE);
    // A 0.10 per-share stop on 10 lots is $100 of risk, not $1.
    expect((await screen.findAllByText('-$100.00')).length).toBeGreaterThan(0);
    expect(screen.queryByText('-$1.00')).not.toBeInTheDocument();
  });

  test('the size is labelled in contracts, not shares', async () => {
    await openStats(OPTION_TRADE);
    expect(await screen.findByText('Contracts traded')).toBeInTheDocument();
    expect(screen.queryByText('Stocks traded')).not.toBeInTheDocument();
  });

  test('a stock on the same numbers keeps multiplier 1 and does not change', async () => {
    await openStats({
      ...OPTION_TRADE, id: 202, ticker: 'AAPL', instrument_type: 'STOCK',
      gross_pnl: 10, net_pnl: 10, executions: fills(2.0, 3.0, 10),
    });
    // 10 profit on a 20 cost, the same 50% by coincidence of the numbers, but no x100 involved.
    expect((await screen.findAllByText('+50.00%')).length).toBeGreaterThan(0);
    expect((await screen.findAllByText('$20.00')).length).toBeGreaterThan(0);
    expect(await screen.findByText('Stocks traded')).toBeInTheDocument();
  });

  test('a future derives no ROI at all, since its multiplier is not the contract size', async () => {
    await openStats({
      ...OPTION_TRADE, id: 203, ticker: '/ES', instrument_type: 'FUTURE',
      gross_pnl: 200, net_pnl: 200, executions: fills(5000, 5002, 2),
    });
    // 5000 x 2 is not $10,000 of cost that could divide into a meaningful ROI, so the rows are
    // left out rather than showing a number that happens to look reasonable.
    expect(screen.queryByText('Net ROI')).not.toBeInTheDocument();
    expect(screen.queryByText('Adjusted Cost')).not.toBeInTheDocument();
    expect(await screen.findByText('Contracts traded')).toBeInTheDocument();
  });
});
