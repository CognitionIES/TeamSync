// messages.ts

interface Messages {
  [key: string]: string[];
}

const messages: Messages = {
  general: [
    "What’s the deal with deadlines? They’re like parking spots—sometimes you circle around and realize you missed it by that much",
    "Resources are tighter than a comic book convention budget. Prioritize wisely",
    "Found a bug? Report it. Because nobody likes surprises, unless it’s a surprise party with soup dumplings.",
    "Remember, the only thing worse than a bug is a bug that’s not reported. It’s like a bad haircut—everyone sees it, but nobody wants to talk about it",
    "The deadline is approaching faster than a cat on a laser pointer. Stay focused!",
    "Deadline is a negative inspiration, still better than no inspiration at all",
    "I’m not lazy, I’m just conserving energy for… nothing",
  ],
  error: [
    "You’ve wandered too far from the path, my friend.",
    "You just broke the whole damn system!",
    "This gate is closed to you, and for good reason",
    "The gods have no mercy, and neither does this server",
    "Not today",
    "The server is down, and so is my mood",
    "Houston, we have a problem",
    "An error occurred, but don’t worry, it’s not your fault… this time",
    "The server is taking a coffee break, please try again later",
  ],
  loading: [
    "Patience is the key to victory, not speed.",
    "I’m waiting, I’m waiting… still waiting!",
    "Giddy-up!",
    "I’m thinking… I’m thinking!",
    "A man must wait, and watch, and never forget.",
    "Loading...",
    "Waiting for the magic to happen...",
    "The gears are grinding, but the engine is still warming up.",
    "The clock is ticking, but the hands are stuck.",
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
