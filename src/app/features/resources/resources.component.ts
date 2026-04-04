import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';

interface Resource {
  name: string;
  description: string;
  url: string;
  category: string;
  free: boolean;
}

@Component({
  selector: 'app-resources',
  standalone: true,
  imports: [MatCardModule, MatButtonModule, MatIconModule, MatChipsModule],
  template: `
    <div class="resources-page">
      <h1 class="page-title">Resources & Tools</h1>
      <p class="page-desc">Curated tools, frameworks, and services mentioned across our tutorials. Start building with AI today.</p>

      @for (cat of categories; track cat) {
        <h2 class="section-title">{{ cat }}</h2>
        <div class="card-grid">
          @for (r of getByCategory(cat); track r.name) {
            <mat-card class="resource-card">
              <mat-card-header>
                <mat-card-title>{{ r.name }}</mat-card-title>
                <mat-card-subtitle>
                  @if (r.free) {
                    <mat-chip class="free-chip">Free</mat-chip>
                  }
                </mat-card-subtitle>
              </mat-card-header>
              <mat-card-content>
                <p>{{ r.description }}</p>
              </mat-card-content>
              <mat-card-actions>
                <a mat-button [href]="r.url" target="_blank" rel="noopener">
                  <mat-icon>open_in_new</mat-icon> Visit
                </a>
              </mat-card-actions>
            </mat-card>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .resources-page {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2.5rem 1.5rem;
    }

    .page-title {
      font-size: 2rem;
      font-weight: 700;
      color: #1e293b;
      margin: 0 0 0.5rem;
    }

    .page-desc {
      font-size: 1.05rem;
      color: #475569;
      margin: 0 0 2rem;
      max-width: 700px;
    }

    .section-title {
      font-size: 1.3rem;
      font-weight: 600;
      color: #334155;
      margin: 2rem 0 1rem;
      padding-top: 1rem;
      border-top: 1px solid #e2e8f0;
    }

    .section-title:first-of-type {
      border-top: none;
      padding-top: 0;
    }

    .card-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1.25rem;
    }

    .resource-card {
      transition: box-shadow 0.2s;
    }
    .resource-card:hover {
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.1);
    }

    .resource-card p {
      color: #475569;
      font-size: 0.9rem;
      line-height: 1.5;
    }

    .free-chip {
      background: #22c55e !important;
      color: #fff !important;
      font-size: 0.75rem !important;
    }
  `],
})
export class ResourcesComponent {
  resources: Resource[] = [
    // Local AI
    { name: 'Ollama', description: 'Run open-source LLMs locally with one command. Supports Llama, Mistral, Phi, and hundreds more.', url: 'https://ollama.com', category: 'Local AI', free: true },
    { name: 'LM Studio', description: 'Desktop app for discovering, downloading, and running local LLMs with a chat UI.', url: 'https://lmstudio.ai', category: 'Local AI', free: true },
    { name: 'llama.cpp', description: 'C/C++ inference engine for running GGUF models on CPU and GPU. Maximum performance.', url: 'https://github.com/ggml-org/llama.cpp', category: 'Local AI', free: true },

    // AI Coding Tools
    { name: 'Cursor', description: 'AI-native code editor that understands your entire codebase. Built on VS Code.', url: 'https://cursor.com', category: 'AI Coding Tools', free: false },
    { name: 'GitHub Copilot', description: 'AI pair programmer that suggests code inline as you type.', url: 'https://github.com/features/copilot', category: 'AI Coding Tools', free: false },
    { name: 'Claude Code', description: 'Command-line AI agent that reads, edits, and tests code across your whole repo.', url: 'https://claude.ai/code', category: 'AI Coding Tools', free: false },
    { name: 'Continue', description: 'Open-source AI code assistant for VS Code and JetBrains. Works with local models.', url: 'https://continue.dev', category: 'AI Coding Tools', free: true },

    // RAG & Vector Databases
    { name: 'Pinecone', description: 'Managed vector database for building RAG applications at scale.', url: 'https://www.pinecone.io', category: 'RAG & Vector Databases', free: false },
    { name: 'ChromaDB', description: 'Open-source embedding database. Run locally or in the cloud.', url: 'https://www.trychroma.com', category: 'RAG & Vector Databases', free: true },
    { name: 'LangChain', description: 'Framework for building LLM-powered applications with chains, agents, and retrieval.', url: 'https://www.langchain.com', category: 'RAG & Vector Databases', free: true },

    // AI Models & APIs
    { name: 'Hugging Face', description: 'The hub for open-source AI models, datasets, and spaces.', url: 'https://huggingface.co', category: 'AI Models & APIs', free: true },
    { name: 'OpenAI API', description: 'GPT-4, DALL-E, and Whisper APIs for building AI applications.', url: 'https://platform.openai.com', category: 'AI Models & APIs', free: false },
    { name: 'Anthropic API', description: 'Claude API for building safe, capable AI applications.', url: 'https://www.anthropic.com/api', category: 'AI Models & APIs', free: false },

    // Learning
    { name: 'OWASP API Security Top 10', description: 'The definitive guide to the most critical API security risks.', url: 'https://owasp.org/API-Security/', category: 'Learning & Reference', free: true },
    { name: 'The Illustrated Transformer', description: 'Jay Alammar\'s visual guide to the Transformer architecture.', url: 'https://jalammar.github.io/illustrated-transformer/', category: 'Learning & Reference', free: true },
    { name: 'Attention Is All You Need', description: 'The original 2017 Transformer paper by Vaswani et al.', url: 'https://arxiv.org/abs/1706.03762', category: 'Learning & Reference', free: true },
  ];

  categories = [...new Set(this.resources.map(r => r.category))];

  getByCategory(cat: string): Resource[] {
    return this.resources.filter(r => r.category === cat);
  }
}

export default ResourcesComponent;
