import { QueryClient, QueryClientProvider as Provider } from '@tanstack/react-query';
import { ReactNode, createElement } from 'react';

const queryClient = new QueryClient();

export function QueryClientProvider({ children }: { children: ReactNode }) {
  return createElement(Provider, { client: queryClient }, children);
}

export { queryClient };
