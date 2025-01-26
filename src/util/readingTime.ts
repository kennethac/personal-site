const wordsPerMinute = 240

export const getArticleLengthInfo = (text: string) => {
    const words = text.match(/\w+/g);
    const length = words?.length ?? 0;
    return {words: length, minutesEstimate: Math.round(length / wordsPerMinute)};
}
