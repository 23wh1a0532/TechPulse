# TechPulse

TechPulse is a full-stack personalized digital magazine web application that fetches live articles from multiple external sources, organizes them into category-based sections, personalizes content using user interests, and presents everything in a magazine-style reading experience.

It also includes secure authentication, saved reading lists, archived issues, and AI-generated article briefs.

## 🎥 Project Demo
👉 [Watch Full Execution Video](https://drive.google.com/file/d/1YGpdGB1YIZNQ_PiNTa7-rgcWUPMRvuFq/view?usp=sharing)

## Features

- User signup and login
- JWT-based authentication
- Magazine-style article layout
- Category-wise content organization
- Save articles to reading list
- Archive complete magazine issues
- AI-generated article briefs
- Fallback content support if APIs fail

## Categories

TechPulse organizes content into these main categories:

- Technology & Innovation
- Science & Research
- Environment & Global
- Careers & Industry

## Tech Stack

### Frontend
- HTML
- CSS
- JavaScript

### Backend
- Node.js
- Express.js

### Database
- MongoDB
- Mongoose

### Authentication
- JWT
- bcryptjs

### API / Utilities
- Axios
- dotenv
- cors

### AI Integration
- Ollama

## APIs Used

- **Technology & Innovation**: NewsAPI
- **Science & Research**: NewsAPI, with NASA API as fallback
- **Environment & Global**: GNews, then NewsAPI, then Google News RSS fallback
- **Careers & Industry**: GNews, then NewsAPI, then Google News RSS fallback

## AI Features

TechPulse uses **Ollama** for local AI-based summarization.

AI is used for:
- article brief generation
- magazine summary generation
- improving readability of fetched content

Default models used in code:
- `mistral:latest` for magazine generation
- `llama3.2:3b` for article brief generation

## Project Structure

```bash
TechPulse/
│
├── backend/
│   ├── config/
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── utils/
│   ├── server.js
│   ├── package.json
│
├── frontend/
│   ├── index.html
│   ├── home.html
│   ├── login.html
│   ├── signup.html
│   ├── archive.html
│   ├── reading-list.html
│   ├── auth.js
│   ├── styles.css
│
└── README.md
```

## Main Modules

### Frontend
- `index.html` – main magazine page
- `home.html` – landing page
- `login.html` – login page
- `signup.html` – signup page
- `archive.html` – archived issues page
- `reading-list.html` – saved articles page
- `auth.js` – session handling and API communication
- `styles.css` – full project styling

### Backend
- `server.js` – Express server entry point
- `config/db.js` – MongoDB connection
- `models/User.js` – user schema
- `routes/auth.js` – auth, bookmarks, archives
- `routes/insights.js` – live content and AI brief routes
- `services/` – article fetching and AI processing
- `utils/` – filtering, simplification, RSS parsing

## How It Works

1. User signs up or logs in.
2. Backend verifies credentials and returns a JWT token.
3. Frontend stores the token in local storage.
4. Frontend requests live magazine data from the backend.
5. Backend fetches articles from external APIs.
6. Articles are filtered by language, relevance, and content quality.
7. Content is categorized and personalized based on user interests.
8. The frontend renders the issue in a magazine-style interface.
9. Users can save articles, archive issues, and open AI briefs.

## Personalization

TechPulse supports interest-based ranking of articles.

Supported interests include:
- AI
- Cybersecurity
- Cloud
- Startups
- Space
- Science
- Climate
- Careers

The system checks article content against interest keywords and ranks matching stories higher for the user.

## Environment Variables

Create a `.env` file inside the `backend/` folder and add:

```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret

NEWS_API_KEY=your_newsapi_key
GNEWS_API_KEY=your_gnews_key
NASA_API_KEY=your_nasa_key

OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=mistral:latest
OLLAMA_TIMEOUT_MS=15000

USE_OLLAMA=false
USE_OLLAMA_MAGAZINE=false
USE_OLLAMA_ARTICLE_BRIEF=false

OLLAMA_ARTICLE_CONTENT_LIMIT=2200
OLLAMA_ARTICLE_BATCH_SIZE=1
```

## Installation

### 1. Clone the repository
```bash
git clone <your-repo-url>
cd TechPulse
```

### 2. Install backend dependencies
```bash
cd backend
npm install
```

### 3. Add environment variables
Create `backend/.env` and add the required keys.

### 4. Start the backend server
```bash
npm start
```

### 5. Open the app
Visit:

```bash
http://localhost:5000
```

## Authentication Flow

- User registers or logs in
- Password is hashed using `bcryptjs`
- JWT token is generated after login
- Protected routes require the token
- User-specific actions include:
  - saving bookmarks
  - viewing reading list
  - archiving issues
  - reopening archived issues

## Archive Feature

TechPulse allows users to save entire magazine issues as archives.

Users can:
- archive the current issue
- reopen archived issues later
- delete archived issues

This preserves the issue snapshot for future reading.

## Reading List Feature

Users can save:
- regular article bookmarks
- AI-generated article briefs

Saved items appear in the reading list page.

## Fallback Support

The project is designed to remain usable even when external services fail.

Fallback support includes:
- local backup article content
- RSS-based fallback for some categories
- local simplified summaries if AI is unavailable
- fallback issue generation if Ollama is disabled

## Strengths of the Project

- Full-stack implementation
- Real-time content integration
- Category-based organization
- Personalized reading experience
- AI-assisted summarization
- Archive and reading list support
- Works even if some APIs fail

## Future Improvements

- Add automated testing
- Improve frontend modularity
- Add profile/preferences page to main navigation if needed
- Use a frontend framework like React for scalability
- Improve archive compression/storage strategy
- Add admin or analytics features

## Authors

Developed as a college full-stack project by a 3-member team:
- Frontend Developer
- Backend Developer
- Content & AI Developer

## License

This project is for educational purposes.

