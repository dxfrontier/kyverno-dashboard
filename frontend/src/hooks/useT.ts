import { useCallback } from 'react';
import { translations } from '../constants/i18n';

export function useT(): { t: (key: string) => string } {
  const t = useCallback((key: string): string => {
    return translations[key] || key;
  }, []);

  return { t };
}
