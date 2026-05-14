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

    // Запрос к Groq (Llama 3.3 70B)
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'Ты — рекомендательный сервис. Отвечай строго в JSON на русском языке. Без markdown, без ```json```.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.8,
        max_tokens: 600,
        response_format: { type: 'json_object' }, // JSON mode у Groq
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
