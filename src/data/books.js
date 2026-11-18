/* Library catalogue — three shelves, three levels, eight books per level.
   Book IDs (B-001 …) are stable; `out` marks copies currently issued. */
const SHELVES = [
  {
    id: 'A',
    name: 'Islamic Studies',
    books: [
      ['Stories of the Prophets', 'Ibn Kathir'],
      ['Seerah: Life of the Prophet ﷺ', 'Safiur Rahman Mubarakpuri'],
      ['Forty Hadith', 'Imam an-Nawawi'],
      ['Riyad as-Salihin', 'Imam an-Nawawi'],
      ['Fiqh Made Simple', 'College Faculty'],
      ['Tajweed Rules Workbook', 'College Faculty'],
      ['Tafsir Notes · Juz 30', 'College Faculty'],
      ['Etiquette of the Student', 'Ibn Jamaah'],
      ['Islamic History · Vol 1', 'College Faculty'],
      ['Islamic History · Vol 2', 'College Faculty'],
      ['Usul al-Fiqh Primer', 'College Faculty'],
      ['Aqeedah for Beginners', 'College Faculty'],
      ['Arabic Grammar · Book 1', 'Madinah Series'],
      ['Arabic Grammar · Book 2', 'Madinah Series'],
      ['Arabic Grammar · Book 3', 'Madinah Series'],
      ['Arabic Reader', 'College Faculty'],
      ['Muslim Scholars of Kerala', 'College Faculty'],
      ['Biographies of the Companions', 'College Faculty'],
      ['Duas for Daily Life', 'College Faculty'],
      ['Hadith Terminology', 'College Faculty'],
      ['Mosques of the World', 'College Faculty'],
      ['Ethics & Character', 'College Faculty'],
      ['Seerah Quiz Book', 'College Faculty'],
      ['Ramadan Reflections', 'College Faculty'],
    ],
  },
  {
    id: 'B',
    name: 'Science & Maths',
    books: [
      ['Physics Made Fun', 'College Faculty'],
      ['Chemistry Basics', 'College Faculty'],
      ['Biology: Life Around Us', 'College Faculty'],
      ['Algebra Step by Step', 'College Faculty'],
      ['Geometry in Pictures', 'College Faculty'],
      ['Statistics for Everyone', 'College Faculty'],
      ['Computer Basics', 'College Faculty'],
      ['Learn to Code with Python', 'College Faculty'],
      ['Web Design for Beginners', 'College Faculty'],
      ['Astronomy & the Night Sky', 'College Faculty'],
      ['The Human Body', 'College Faculty'],
      ['Earth & Environment', 'College Faculty'],
      ['Calculus Without Tears', 'College Faculty'],
      ['Puzzles & Logic', 'College Faculty'],
      ['Great Inventions', 'College Faculty'],
      ['Muslim Scientists of the Golden Age', 'College Faculty'],
      ['Electricity at Home', 'College Faculty'],
      ['Plants of Kerala', 'College Faculty'],
      ['Mental Maths Tricks', 'College Faculty'],
      ['Robots and AI', 'College Faculty'],
      ['Data & Spreadsheets', 'College Faculty'],
      ['Weather and Climate', 'College Faculty'],
      ['Science Experiments at Home', 'College Faculty'],
      ['Numbers in Nature', 'College Faculty'],
    ],
  },
  {
    id: 'C',
    name: 'Languages & Stories',
    books: [
      ['English Grammar in Use', 'College Faculty'],
      ['Essay Writing Skills', 'College Faculty'],
      ['Malayalam Short Stories', 'Collected'],
      ['Urdu Poetry Selections', 'Collected'],
      ['Spoken English Daily', 'College Faculty'],
      ['Vocabulary Builder', 'College Faculty'],
      ['Public Speaking', 'College Faculty'],
      ['Letter & Email Writing', 'College Faculty'],
      ['World Folk Tales', 'Collected'],
      ['Kerala Through the Ages', 'College Faculty'],
      ['Geography Atlas', 'College Faculty'],
      ['Indian Constitution Simplified', 'College Faculty'],
      ['Study Skills Handbook', 'College Faculty'],
      ['Time Management for Students', 'College Faculty'],
      ['Arabic–English Dictionary', 'Reference'],
      ['English–Malayalam Dictionary', 'Reference'],
      ['Poems for Young Readers', 'Collected'],
      ['Travel Diaries', 'Collected'],
      ['Career Guide', 'College Faculty'],
      ['General Knowledge 2026', 'Reference'],
      ['Quiz Champion', 'Reference'],
      ['Debate Topics', 'College Faculty'],
      ['Creative Writing Prompts', 'College Faculty'],
      ['Reading Journal', 'College Faculty'],
    ],
  },
  {
    id: 'D',
    name: 'Computers & Skills',
    books: [
      ['Introduction to Computers', 'College Faculty'],
      ['MS Office Step by Step', 'College Faculty'],
      ['HTML and CSS Basics', 'College Faculty'],
      ['JavaScript for Beginners', 'College Faculty'],
      ['Python Projects for Students', 'College Faculty'],
      ['Databases Made Easy', 'College Faculty'],
      ['Internet Safety Guide', 'College Faculty'],
      ['Digital Design with Canva', 'College Faculty'],
      ['Typing Tutor Workbook', 'College Faculty'],
      ['Computer Networks Basics', 'College Faculty'],
      ['Mobile Apps 101', 'College Faculty'],
      ['Algorithms in Pictures', 'College Faculty'],
      ['Spreadsheet Formulas', 'College Faculty'],
      ['Presentation Skills', 'College Faculty'],
      ['Photography Basics', 'College Faculty'],
      ['Video Editing Starter', 'College Faculty'],
      ['Accounting Basics', 'College Faculty'],
      ['Entrepreneurship for Students', 'College Faculty'],
      ['Personal Finance', 'College Faculty'],
      ['Leadership & Teamwork', 'College Faculty'],
      ['First Aid Handbook', 'Reference'],
      ['Cooking & Nutrition', 'College Faculty'],
      ['Gardening at Home', 'College Faculty'],
      ['Sports & Fitness', 'College Faculty'],
    ],
  },
  {
    id: 'E',
    name: 'History & Reference',
    books: [
      ['History of India · Ancient', 'College Faculty'],
      ['History of India · Medieval', 'College Faculty'],
      ['History of India · Modern', 'College Faculty'],
      ['Freedom Struggle Stories', 'College Faculty'],
      ['World History in Maps', 'College Faculty'],
      ['Andalusia: A Golden Age', 'College Faculty'],
      ['The Ottoman World', 'College Faculty'],
      ['Kerala Muslim Heritage', 'College Faculty'],
      ['Great Libraries of the World', 'College Faculty'],
      ['Indian Economy Basics', 'College Faculty'],
      ['Political Science Primer', 'College Faculty'],
      ['Sociology for Beginners', 'College Faculty'],
      ['Psychology in Daily Life', 'College Faculty'],
      ['Philosophy for Students', 'College Faculty'],
      ['Environmental Studies', 'College Faculty'],
      ['Concise Encyclopedia', 'Reference'],
      ['Arabic Thesaurus', 'Reference'],
      ['Malayalam Dictionary', 'Reference'],
      ['Year Book 2026', 'Reference'],
      ['Atlas of Kerala', 'Reference'],
      ['Competitive Exam Guide', 'Reference'],
      ['Previous Question Papers', 'College Faculty'],
      ['Research Methods', 'College Faculty'],
      ['Thesis Writing Guide', 'College Faculty'],
    ],
  },
];
const LANG = {
  A: ['English', 'Arabic', 'Malayalam'],
  B: ['English'],
  C: ['English', 'Malayalam', 'Urdu'],
  D: ['English'],
  E: ['English', 'Malayalam'],
};
const COLORS = [
  '#ff6b6b',
  '#1cb0f6',
  '#58cc02',
  '#ffc800',
  '#a56cf0',
  '#ff9600',
  '#0e9f9a',
  '#ff86b6',
  '#5b55e8',
  '#2bc4a8',
];

export const BOOK_SHELVES = SHELVES.map((sh, si) => ({
  id: sh.id,
  name: sh.name,
  books: sh.books.map(([title, author], i) => {
    const n = si * 24 + i + 1,
      level = Math.floor(i / 8),
      slot = i % 8,
      copies = 1 + ((n * 5) % 3),
      out = [3, 9, 14, 22, 27, 35, 41, 50, 58, 63, 70, 77, 86, 93, 104, 112].includes(n);
    return {
      id: 'B-' + String(n).padStart(3, '0'),
      title,
      author,
      shelf: sh.name,
      shelfId: sh.id,
      level,
      slot,
      /** where it lives: shelf letter · row (1 = top) · position from the left */
      callNo: `${sh.id}-${level + 1}-${String(slot + 1).padStart(2, '0')}`,
      year: 2008 + ((n * 7) % 18),
      pages: 96 + ((n * 53) % 380),
      language: LANG[sh.id][n % LANG[sh.id].length],
      copies,
      available: out ? 0 : copies,
      color: COLORS[(n * 7) % COLORS.length],
      height: 50 + ((n * 37) % 17),
      width: 0.82 + ((n * 13) % 5) * 0.045,
      out,
    };
  }),
}));
export const ALL_BOOKS = BOOK_SHELVES.flatMap(s => s.books);
export const bookById = id => ALL_BOOKS.find(b => b.id === id);

/* ---------- OPAC search ---------- */
const norm = s =>
  String(s)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\u0600-\u06ff\u0d00-\u0d7f]+/g, ' ')
    .trim();
/**
 * Search the catalogue by title, author, subject (shelf), book ID or call number.
 * Every word must match somewhere; title matches rank first.
 */
export function searchBooks(q, { shelfId = '', availableOnly = false } = {}) {
  const call = /^\s*([a-e])\s*-\s*(\d)(?:\s*-\s*(\d{1,2}))?\s*$/i.exec(q);
  if (call)
    return ALL_BOOKS.filter(
      b =>
        b.callNo.startsWith(call[1].toUpperCase() + '-' + call[2]) &&
        (!call[3] || b.slot + 1 === +call[3]) &&
        (!shelfId || b.shelfId === shelfId) &&
        (!availableOnly || !b.out),
    );
  const words = norm(q).split(' ').filter(Boolean);
  return ALL_BOOKS.map(b => {
    if (shelfId && b.shelfId !== shelfId) return null;
    if (availableOnly && b.out) return null;
    const t = norm(b.title),
      hay = [t, norm(b.author), norm(b.shelf), norm(b.id), norm(b.callNo), norm(b.language)].join(' | ');
    let score = 0;
    for (const w of words) {
      if (!hay.includes(w)) return null;
      score += t.startsWith(w) ? 6 : (' ' + t).includes(' ' + w) ? 4 : t.includes(w) ? 3 : 1;
    }
    return { b, score };
  })
    .filter(Boolean)
    .sort((x, y) => y.score - x.score || x.b.title.localeCompare(y.b.title))
    .map(x => x.b);
}
