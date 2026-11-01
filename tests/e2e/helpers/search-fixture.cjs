// Synthetic chats for conversation search (drawer and Jump to): a title-only match, one match deep in a long
// conversation, several matches in one chat, project chats, an archived chat, chats that don't match, a draft-only
// chat, long text, punctuation and Unicode. Every chat has a project or none; nothing here is real data.
const now = Date.now();
const msg = (id, role, text, ago) => ({ id, role, text, createdAt: now - ago, ...(role === 'assistant' ? { status: 'done', model: 'gemini:gemini-flash-latest' } : {}) });

exports.projects = [{ id: 'sp-portugal', name: 'Trip to Portugal', description: 'Plans and bookings.', instructions: '', color: 'indigo', createdAt: now - 9e8, updatedAt: now - 2e6 }];

// 400 messages (the thread virtualizes past 120); "tram" appears once, in message 37.
const LONG_HIT = 'long-37';
const long = Array.from({ length: 400 }, (_, i) => i === 37
  ? msg(LONG_HIT, 'assistant', 'On day two, skip the bus and take **tram 1** along the Douro to Foz; it runs every 20 minutes.', 4e7 - i * 6e4)
  : msg(`long-${i}`, i % 2 ? 'assistant' : 'user', i % 2 ? `Notes for step ${i}: a quiet walk, a long lunch and an early night.` : `What about step ${i}?`, 4e7 - i * 6e4));

const filler = 'We compared the options for getting around the old town, the hills and the river front. '.repeat(18);

exports.chats = [
  { id: 'sc-title', title: 'Tram tickets', createdAt: now - 3e6, updatedAt: now - 3e6, messages: [
    msg('t-1', 'user', 'How much is a day pass?', 3e6), msg('t-2', 'assistant', 'A 24-hour pass costs about €7.20.', 3e6 - 1e4)] },
  { id: 'sc-long', title: 'Porto week', projectId: 'sp-portugal', createdAt: now - 4e7, updatedAt: now - 2e6, messages: long },
  { id: 'sc-multi', title: 'Lisbon getting around', projectId: 'sp-portugal', createdAt: now - 6e6, updatedAt: now - 5e6, messages: [
    msg('m-1', 'user', 'Is the tram worth it in Lisbon?', 6e6), msg('m-2', 'assistant', 'Yes, for the hills.', 6e6 - 1e4),
    msg('m-3', 'user', 'Which line?', 6e6 - 2e4), msg('m-4', 'assistant', `${filler}Ride TRAM 28 early, before 9, or it fills with tour groups. ${filler}`, 6e6 - 3e4),
    msg('m-5', 'user', 'And at night?', 6e6 - 4e4), msg('m-6', 'assistant', 'Evening trams are quieter; the 12E loops round the castle.', 6e6 - 5e4)] },
  { id: 'sc-archived', title: 'Old Sintra plan', archived: true, createdAt: now - 9e7, updatedAt: now - 9e7, messages: [
    msg('a-1', 'user', 'Can we reach Sintra by tram?', 9e7), msg('a-2', 'assistant', 'No, take the train from Rossio.', 9e7 - 1e4)] },
  { id: 'sc-unicode', title: 'Café notes', createdAt: now - 8e6, updatedAt: now - 8e6, messages: [
    msg('u-1', 'user', 'Translate “Straßenbahn” and «الترام» please — and İSTANBUL’s T1 too! 🚋', 8e6),
    msg('u-2', 'assistant', 'Straßenbahn and الترام both mean tram; İstanbul’s T1 is its oldest line.', 8e6 - 1e4)] },
  { id: 'sc-none', title: 'Birthday gift ideas', createdAt: now - 7e6, updatedAt: now - 7e6, messages: [
    msg('n-1', 'user', 'Ideas for a book lover?', 7e6), msg('n-2', 'assistant', 'A reading light and a good anthology.', 7e6 - 1e4)] },
  { id: 'sc-draft', title: 'Packing list', createdAt: now - 1e6, updatedAt: now - 1e6, messages: [] },
];
exports.LONG_HIT = LONG_HIT;
exports.DRAFT_CHAT = 'sc-draft';
