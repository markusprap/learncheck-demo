
import axios from 'axios';

const dicodingApi = axios.create({
  baseURL: process.env.DICODING_MOCK_API_URL || 'http://localhost:4000',
});

// TODO: Replace with actual API call to Dicoding Mock API
export const getTutorialContent = async (tutorialId: string): Promise<string> => {
  console.log(`Fetching tutorial content for ID: ${tutorialId}`);
  // Mock response for now
  return Promise.resolve(`
    <html>
      <head><title>Mock Tutorial</title></head>
      <body>
        <h1>Introduction to React Hooks</h1>
        <p>React Hooks are functions that let you “hook into” React state and lifecycle features from function components.</p>
        <p>The most commonly used hooks are useState and useEffect. useState allows you to add state to functional components. useEffect allows you to perform side effects in functional components.</p>
        <p>For example, to declare a state variable called 'count', you would write: const [count, setCount] = useState(0);</p>
      </body>
    </html>
  `);
};

// TODO: Replace with actual API call to Dicoding Mock API
export const getUserPreferences = async (userId: string): Promise<any> => {
  console.log(`Fetching user preferences for ID: ${userId}`);
  // Mock response for now
  return Promise.resolve({
    theme: 'dark',
    fontSize: 'large',
    layoutWidth: 'fullWidth',
    fontStyle: 'default',
  });
};
