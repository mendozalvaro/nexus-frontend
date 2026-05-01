export default defineNuxtPlugin(() => {
  return {
    provide: {
      cache: {
        refresh: (key: string) => refreshNuxtData(key),
      },
    },
  };
});
