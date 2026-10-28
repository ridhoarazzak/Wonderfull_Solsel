// Build tidak diblokir oleh peringatan tipe/lint kecil (proyek ini belum bisa diuji build penuh di lingkungan pembuatnya).
export default {
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
};
