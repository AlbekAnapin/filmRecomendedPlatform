export default async function handler(request, response) {
  // Разрешаем запросы только методом POST
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Метод не поддерживается' });
  }

  try {
    const { query } = request.body;

    if (!query) {
      return response.status(400).json({ error: 'Пустой запрос' });
    }

    const prompt = `Ты — рекомендательный сервис...`; // Ваш готовый промпт

    const deepseekResponse = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}` // Ключ из переменных окружения Vercel
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: 'Ты — рекомендательный сервис. Отвечай строго в JSON на русском языке.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.8,
        max_tokens: 600,
        response_format: { type: 'json_object' },
      }),
    });

    const data = await deepseekResponse.json();
    const content = data.choices[0].message.content;
    // Отправляем ответ обратно на фронтенд
    response.status(200).json(JSON.parse(content));
  } catch (error) {
    response.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
}