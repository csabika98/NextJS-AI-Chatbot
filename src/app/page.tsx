import HomePageClient, { ProviderConfig } from '@/app/components/HomePageClient';
import { Provider } from '@/app/utils/MessageManager';

export const dynamic = 'force-dynamic';

const providerOrder: Provider[] = ['ollama', 'openai', 'deepseek'];

const HomePage = () => {
  const ollamaHost = process.env.NEXT_PUBLIC_OLLAMA_HOST;
  const ollamaModel = process.env.NEXT_PUBLIC_CHATBOT_OLLAMA_MODEL_NAME;
  const openaiModel = process.env.NEXT_PUBLIC_OPENAI_DEFAULT_MODEL;
  const deepseekModel = process.env.NEXT_PUBLIC_DEEPSEEK_DEFAULT_MODEL || 'deepseek-v4-flash';

  const providerConfig: ProviderConfig = {
    ollama: {
      enabled: Boolean(ollamaHost && ollamaModel),
      model: ollamaModel || '',
    },
    openai: {
      enabled: Boolean(process.env.OPENAI_API_KEY && openaiModel),
      model: openaiModel || '',
    },
    deepseek: {
      enabled: Boolean(process.env.DEEPSEEK_API_KEY && deepseekModel),
      model: deepseekModel,
    },
  };

  const initialProvider = providerOrder.find((provider) => providerConfig[provider].enabled) || null;

  return <HomePageClient providerConfig={providerConfig} initialProvider={initialProvider} />;
};

export default HomePage;
