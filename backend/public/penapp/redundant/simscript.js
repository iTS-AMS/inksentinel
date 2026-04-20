// 1. Force the app into a connected state and jump to the dashboard
S.connMode = 'usb'; // Bypass hardware checks
onConnected();

// 2. Mock the send function so clicking UI buttons (Warn, Beep, etc.) doesn't throw errors
window.send = async function(obj) {
  const json = JSON.stringify(obj);
  log('out', '[MOCK TX] ' + json);
  return true;
};

// 3. Simulate 3 Wemos units connecting (staggered for realism)
const mockUnits = [
  { event: 'wemos_connected', mac: 'AA:BB:CC:DD:EE:01', id: 1, via: 'mock' },
  { event: 'wemos_connected', mac: 'AA:BB:CC:DD:EE:02', id: 2, via: 'mock' },
  { event: 'wemos_connected', mac: 'AA:BB:CC:DD:EE:03', id: 3, via: 'mock' }
];

mockUnits.forEach((u, i) => {
  setTimeout(() => onMessage(JSON.stringify(u)), i * 400);
});

// 4. Send a fake heartbeat every 3 seconds to keep units "active"
setInterval(() => {
  onMessage(JSON.stringify({
    event: 'heartbeat',
    mode: 'Mock Mode',
    units: mockUnits.map(u => ({ mac: u.mac, id: u.id }))
  }));
}, 3000);