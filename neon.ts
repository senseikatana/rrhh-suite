import { defineConfig } from '@neon/config'

export default defineConfig({
  project: 'polished-dust-56568247',
  branch: 'production',
  services: {
    postgres: true,
    auth: true,
    objectStorage: true,
    functions: true,
    realtime: true,
    aiGateway: true,
  },
})