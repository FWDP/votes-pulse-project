declare const process: {
  env: Record<string, string | undefined>;
};

const MELTWATER_BASE_URL =
  "https://api.meltwater.com/v3";

function sleep(
  milliseconds: number,
) {
  return new Promise((resolve) =>
    setTimeout(
      resolve,
      milliseconds,
    ),
  );
}

export async function meltwaterRequest<T>(
  endpoint: string,

  options: RequestInit = {},

  attempt = 0,
): Promise<T> {
  const apiKey =
    process.env.MELTWATER_API_KEY;

  if (!apiKey) {
    throw new Error(
      "MELTWATER_API_KEY is not configured.",
    );
  }

  const response = await fetch(
    `${MELTWATER_BASE_URL}${endpoint}`,
    {
      ...options,

      headers: {
        Accept:
          "application/json",

        "Content-Type":
          "application/json",

        apikey: apiKey,

        ...options.headers,
      },
    },
  );

  /*
   * Handle temporary Meltwater
   * throttling/service overload.
   */
  if (
    (response.status === 429 ||
      response.status === 503) &&
    attempt < 2
  ) {
    const retryAfter =
      response.headers.get(
        "Retry-After",
      );

    const retryMilliseconds =
      retryAfter &&
      !Number.isNaN(
        Number(retryAfter),
      )
        ? Number(retryAfter) *
          1000
        : 1000 *
          (attempt + 1);

    await sleep(
      retryMilliseconds,
    );

    return meltwaterRequest<T>(
      endpoint,
      options,
      attempt + 1,
    );
  }

  if (!response.ok) {
    const errorBody =
      await response
        .text()
        .catch(() => "");

    throw new Error(
      `Meltwater API ${response.status}: ${
        errorBody ||
        response.statusText
      }`,
    );
  }

  return (await response.json()) as T;
}