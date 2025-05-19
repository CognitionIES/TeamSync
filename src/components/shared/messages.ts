// messages.ts

interface Messages {
  [key: string]: string[];
}

const messages: Messages = {
  general: [
    "What’s the deal with deadlines? They’re like parking spots—sometimes you circle around and realize you missed it by that much",

    "Resources are tighter than a comic book convention budget. Prioritize wisely",
    "Found a bug? Report it. Because nobody likes surprises, unless it’s a surprise party with soup dumplings.",
  ],
  error: [
    "You’ve wandered too far from the path, my friend.",
    "You just broke the whole damn system!",
    "This gate is closed to you, and for good reason",
    "The gods have no mercy, and neither does this server",
    "Not today",
  ],
  loading: [
    "Patience is the key to victory, not speed.",
    "I’m waiting, I’m waiting… still waiting!",
    "Giddy-up!",
    "I’m thinking… I’m thinking!",
    "A man must wait, and watch, and never forget.",
  ],
  completion: [
    "The work is done, and the world takes note.",
    "We’ve hit a milestone! It’s not a Nobel Prize, but it’s our Nobel Prize.",
  ],
  login: [
    "The gate is open, but only the worthy pass through.",
    "Enter your credentials to access your dashboard",
  ],
  wrongPassword: [
    "This gate is closed to you, and for good reason",
    "Not today",
    "Wrong password, try again",
  ],
};

/**
 * Retrieves a random message from the specified category.
 * @param category The category of messages (e.g., 'general', 'error', 'loading')
 * @returns A random message from the category, or an empty string if the category is invalid or empty
 */
export const getRandomMessage = (category: string): string => {
  const messageArray = messages[category] || [];
  if (messageArray.length === 0) return "";
  const randomIndex = Math.floor(Math.random() * messageArray.length);
  return messageArray[randomIndex];
};
