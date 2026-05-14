export default async function handler(request, response) {
  // CORS
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Метод не поддерживается' });
  }

  try {
    const { query } = request.body;
    if (!query || query.trim() === '') {
      return response.status(400).json({ error: 'Пустой запрос' });
    }

    const prompt = `Ты — рекомендательный сервис фильмов, сериалов и книг. Пользователь ввёл: "${query}". Это может быть название фильма, сериала, книги или имя автора, которое ему понравилось.

Выдай ровно 3 рекомендации в формате JSON без лишнего текста, без markdown-разметки, без обрамляющих \`\`\`json\`\`\`. Только чистый JSON-объект.

1. "direct_match" — максимально похожее по жанру, атмосфере, стилю.
2. "surprise" — неожиданный выбор, формально другой, но цепляет ту же аудиторию.
3. "deep_dive" — вариант для глубокого погружения (сериал, цикл книг, сложное произведение), если понравилось "${query}".

Для каждой рекомендации укажи:
- "title": название на русском языке (если есть официальный перевод) или на языке оригинала
- "type": "film" / "series" / "book"
- "reason": 1-2 предложения на русском языке, почему это понравится, с отсылкой к "${query}"
- "year": год выпуска (число, если применимо)`;

    // Запрос к Gemini 2.0 Flash (бесплатно до 1500 запросов/день)
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 600,
            responseMimeType: "application/json",  // JSON mode
          }
        }),
      }
    );

    const data = await geminiResponse.json();

    if (data.error) {
      return response.status(500).json({ error: 'Ошибка API: ' + data.error.message });
    }

    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) {
      return response.status(500).json({ error: 'Не удалось получить рекомендации' });
    }

    return response.status(200).json(JSON.parse(content));

  } catch (error) {
    return response.status(500).json({ error: 'Внутренняя ошибка сервера: ' + error.message });
  }
}
