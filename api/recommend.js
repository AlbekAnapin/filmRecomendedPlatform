export default async function handler(request, response) {
  // Универсальная установка CORS для всех ответов
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Обработка предзапроса браузера (OPTIONS)
  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Метод не поддерживается' });
  }

  try {
    const { query, preferences, searchFilms, searchBooks, genres } = request.body;

    if (!query && !preferences && (!genres || genres.length === 0)) {
      return response.status(400).json({ error: 'Укажите хотя бы название, пожелания или выберите жанр' });
    }

    const wantFilms = searchFilms !== false;
    const wantBooks = searchBooks !== false;
    let contentTypeInstruction;
    if (wantFilms && wantBooks) contentTypeInstruction = 'фильмы, сериалы и книги';
    else if (wantFilms) contentTypeInstruction = 'только фильмы и сериалы (без книг)';
    else if (wantBooks) contentTypeInstruction = 'только книги (без фильмов)';
    else contentTypeInstruction = 'фильмы, сериалы и книги';

    const preferenceText = preferences ? ` Дополнительные пожелания: ${preferences}.` : '';
    const genreText = (genres && genres.length > 0) ? ` Предпочитаемые жанры: ${genres.join(', ')}.` : '';
    const searchQuery = query ? `Пользователь ищет: "${query}".` : 'Подбери рекомендации на основе пожеланий.';

    const prompt = `${searchQuery} ${genreText} ${preferenceText} Подбери ${contentTypeInstruction}. Для каждого элемента добавь краткое описание (2-3 предложения на русском) сюжета или содержания. Выдай строго JSON без markdown.

Формат ответа:
{
  "films": [
    {
      "title": "Название",
      "type": "film или series",
      "year": 2023,
      "genres": ["жанр1", "жанр2"],
      "reason": "Почему подходит (1-2 предложения)",
      "description": "Краткое описание сюжета (2-3 предложения)",
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
      "description": "О чём книга (2-3 предложения)",
      "rating": 4.2
    }
  ]
}
Если запрошены и фильмы, и книги — 4-5 фильмов и 3-4 книги.
Если только фильмы — 6-7 фильмов, books: [].
Если только книги — 5-6 книг, films: [].
Все названия, причины и описания на русском. Рейтинг для фильмов до 10, для книг до 5.`;

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
        max_tokens: 1500,
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
    // Даже при внутренней ошибке CORS-заголовки уже установлены
    return response.status(500).json({ error: 'Внутренняя ошибка сервера: ' + error.message });
  }
}
