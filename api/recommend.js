export default async function handler(request, response) {
  // CORS
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (request.method === 'OPTIONS') return response.status(200).end();
  if (request.method !== 'POST') return response.status(405).json({ error: 'Метод не поддерживается' });

  try {
    const { query, preferences, searchFilms, searchBooks } = request.body;
    if (!query || query.trim() === '') {
      return response.status(400).json({ error: 'Пустой запрос' });
    }

    // Определяем типы контента
    const wantFilms = searchFilms !== false; // по умолчанию true
    const wantBooks = searchBooks !== false;
    let contentTypeInstruction;
    if (wantFilms && wantBooks) {
      contentTypeInstruction = 'фильмы, сериалы и книги';
    } else if (wantFilms) {
      contentTypeInstruction = 'только фильмы и сериалы (без книг)';
    } else if (wantBooks) {
      contentTypeInstruction = 'только книги (без фильмов)';
    } else {
      contentTypeInstruction = 'фильмы, сериалы и книги';
    }

    const preferenceText = preferences ? ` Дополнительные пожелания: ${preferences}.` : '';

    const prompt = `Ты — рекомендательный сервис. Пользователь ищет: "${query}". ${preferenceText} Подбери ${contentTypeInstruction}. Выдай строго JSON без markdown-разметки.

Формат ответа:
{
  "films": [
    {
      "title": "Название фильма или сериала",
      "type": "film или series",
      "year": 2023,
      "genres": ["жанр1", "жанр2"],
      "reason": "Почему подходит (1-2 предложения на русском)",
      "rating": 8.5
    }
  ],
  "books": [
    {
      "title": "Название книги",
      "type": "book",
      "year": 2020,
      "genres": ["жанр"],
      "reason": "Почему подходит",
      "rating": 4.2
    }
  ]
}

Если запрошены и фильмы, и книги — выдай 4-5 фильмов и 3-4 книги.
Если только фильмы — выдай 6-7 фильмов, массив "books" оставь пустым.
Если только книги — выдай 5-6 книг, массив "films" оставь пустым.
Все названия и причины пиши на русском языке. Рейтинг для фильмов — по шкале Кинопоиска/IMDb (до 10), для книг — средний рейтинг (до 5).`;

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'Ты — рекомендательный сервис. Отвечай строго в JSON на русском языке. Не добавляй markdown.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.8,
        max_tokens: 1200,
        response_format: { type: 'json_object' },
      }),
    });

    const data = await groqResponse.json();
    if (data.error) {
      return response.status(500).json({ error: 'Ошибка API: ' + data.error.message });
    }
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return response.status(500).json({ error: 'Не удалось получить рекомендации' });
    }

    return response.status(200).json(JSON.parse(content));

  } catch (error) {
    return response.status(500).json({ error: 'Внутренняя ошибка сервера: ' + error.message });
  }
}
