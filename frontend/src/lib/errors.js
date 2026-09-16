// Backend hataları { error, code } şeklinde döner.
export function getErrorMessage(error, fallback = 'Beklenmeyen bir hata oluştu.') {
  if (!error) return fallback;

  if (error.status === 'FETCH_ERROR') {
    return 'Sunucuya ulaşılamadı. Backend çalışıyor mu?';
  }
  if (error.status === 'PARSING_ERROR') {
    return 'Sunucudan beklenmeyen bir yanıt geldi.';
  }

  return error.data?.error || error.error || fallback;
}

export function getErrorCode(error) {
  return error?.data?.code;
}
