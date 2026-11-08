import { createClient } from '@neondatabase/serverless';
import { BetterAuthReactAdapter } from '@neondatabase/neon-js/auth/react/adapters';

// Neon Auth configuration
const neon = createClient({
  auth: {
    url: import.meta.env.VITE_NEON_AUTH_URL || process.env.AUTH_URL,
    adapter: BetterAuthReactAdapter(),
  },
});

export default neon;