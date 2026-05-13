export default {
  async fetch(request, env) {
    // Обработка CORS (предзапрос OPTIONS)
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    // Принимаем только POST-запросы
    if (request.method !== 'POST') {
      return new Response('Метод не поддерживается', { status: 405 });
    }

    try {
      // Получаем запрос от фронтенда
      const { query } = await request.json();

      if (!query || query.trim() === '') {
        return new Response(JSON.stringify({ error: 'Пустой запрос' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      // Промпт для нейросети
      const prompt = `Ты — рекомендательный сервис фильмов, сериалов и книг. Пользователь ввёл: "${query}". Это может быть название фильма, сериала, книги или имя автора, которое ему понравилось.

Выдай ровно 3 рекомендации в формате JSON без лишнего текста, без markdown-разметки, без обрамляющих ```json```. Только чистый JSON-объект.

1. "direct_match" — максимально похожее по жанру, атмосфере, стилю.
2. "surprise" — неожиданный выбор, формально другой, но цепляет ту же аудиторию.
3. "deep_dive" — вариант для глубокого погружения (сериал, цикл книг, сложное произведение), если понравилось "${query}".

Для каждой рекомендации укажи:
- "title": название на русском языке (если есть официальный перевод) или на языке оригинала
- "type": "film" / "series" / "book"
- "reason": 1-2 предложения на русском языке, почему это понравится, с отсылкой к "${query}"
- "year": год выпуска (число, если применимо)

Пример формата:
{
  "direct_match": {
    "title": "Начало",
    "type": "film",
    "reason": "Та же многослойная игра со временем и реальностью, что и в «Доводе». Нолан снова заставляет мозг кипеть.",
    "year": 2010
  },
  "surprise": {
    "title": "Грань будущего",
    "type": "film",
    "reason": "Кажется боевиком, но временная петля даёт тот же драйв, что и инверсия в «Доводе».",
    "year": 2014
  },
  "deep_dive": {
    "title": "Тьма",
    "type": "series",
    "reason": "Три сезона временных парадоксов и семейных тайн. После «Довода» захочется распутывать этот клубок.",
    "year": 2017
  }
}`;

      // Запрос к DeepSeek API
      const deepseekResponse = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: 'Ты — рекомендательный сервис. Отвечай строго в JSON на русском языке. Без markdown, без ```json```.',
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0.8,
          max_tokens: 600,
          response_format: { type: 'json_object' },
        }),
      });

      const data = await deepseekResponse.json();

      // Проверка на ошибки DeepSeek
      if (data.error) {
        return new Response(JSON.stringify({ error: 'Ошибка API: ' + data.error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        return new Response(JSON.stringify({ error: 'Не удалось получить рекомендации' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      // Отдаём результат фронтенду
      return new Response(content, {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
        },
      });

    } catch (error) {
      return new Response(JSON.stringify({ error: 'Внутренняя ошибка сервера' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }
  },
};