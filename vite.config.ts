import { defineConfig } from 'vite';

// Relative base so the same build works at a domain root and under a
// sub-path such as GitHub Pages' /one-more-take/.
export default defineConfig({ base: './' });
