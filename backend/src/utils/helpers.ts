// Shared utility functions
export const pick = <T extends object, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> => {
  return keys.reduce((acc, key) => {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      acc[key] = obj[key];
    }
    return acc;
  }, {} as Pick<T, K>);
};

export const omit = <T extends object, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K> => {
  const result = { ...obj };
  keys.forEach((key) => delete result[key]);
  return result as Omit<T, K>;
};

export const paginate = (
  page: number,
  limit: number,
  maxLimit = 100
): { skip: number; limit: number; page: number } => {
  const safeLimit = Math.min(Math.max(1, limit), maxLimit);
  const safePage = Math.max(1, page);
  return {
    skip: (safePage - 1) * safeLimit,
    limit: safeLimit,
    page: safePage,
  };
};

export const paginatedResponse = <T>(
  items: T[],
  total: number,
  page: number,
  limit: number
) => ({
  items,
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
});
