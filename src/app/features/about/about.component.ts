import { Component, inject, OnInit } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { ContentService } from '../../shared/services/content.service';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [MatCardModule, MatIconModule, MatButtonModule],
  template: `
    <div class="about-page">
      <section class="about-hero">
        <h1>About AmtocBot</h1>
        <p class="lead">
          AmtocBot is a configurable AI clone of a CEO, designed to automate
          content creation, publishing, and audience engagement across multiple
          platforms. It researches trending topics, generates blog posts, videos,
          podcasts, and social media content, then publishes and cross-posts to
          reach the widest audience organically.
        </p>
      </section>

      <section class="section">
        <mat-card class="info-card">
          <h2>About AmtocSoft</h2>
          <p>
            AmtocSoft is the AI-driven content automation platform behind AmtocBot.
            The system is fully self-learning: every publishing cycle feeds engagement
            metrics back into the next cycle's content decisions, continuously refining
            strategy for better reach and impact.
          </p>
          <p>
            Our mission is to demonstrate that AI can produce genuine, high-quality
            tech education content at scale while maintaining transparency and
            organic growth.
          </p>
        </mat-card>
      </section>

      <section class="section">
        <h2 class="section-title">Platform Accounts</h2>
        <div class="platform-list">
          @for (p of content.platforms(); track p.platform) {
            <mat-card class="platform-card">
              <div class="platform-row">
                <mat-icon>{{ p.icon }}</mat-icon>
                <div class="platform-info">
                  <strong>{{ p.platform }}</strong>
                  <span class="handle">{{ p.handle }}</span>
                </div>
                <a mat-button [href]="p.url" target="_blank" rel="noopener">
                  Visit
                </a>
              </div>
            </mat-card>
          }
        </div>
      </section>

      <section class="section contact-section">
        <mat-card class="contact-card">
          <mat-icon class="contact-icon">email</mat-icon>
          <h2>Get in Touch</h2>
          <p>Questions, feedback, or collaboration ideas?</p>
          <a mat-raised-button color="primary" href="mailto:hello@amtocbot.com">
            hello&#64;amtocbot.com
          </a>
        </mat-card>
      </section>
    </div>
  `,
  styles: [`
    .about-page {
      max-width: 900px;
      margin: 0 auto;
      padding: 2.5rem 1.5rem;
    }

    .about-hero {
      text-align: center;
      margin-bottom: 2.5rem;
    }

    .about-hero h1 {
      font-size: 2.2rem;
      font-weight: 700;
      color: #1e293b;
      margin: 0 0 1rem;
    }

    .lead {
      font-size: 1.1rem;
      color: #475569;
      line-height: 1.7;
      max-width: 700px;
      margin: 0 auto;
    }

    .section {
      margin-bottom: 2.5rem;
    }

    .section-title {
      font-size: 1.3rem;
      font-weight: 600;
      color: #334155;
      margin: 0 0 1rem;
    }

    .info-card {
      padding: 2rem;
    }

    .info-card h2 {
      margin: 0 0 1rem;
      font-size: 1.4rem;
      color: #1e293b;
    }

    .info-card p {
      color: #475569;
      line-height: 1.7;
      margin: 0 0 1rem;
    }

    .info-card p:last-child { margin-bottom: 0; }

    .platform-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .platform-card { padding: 1rem 1.5rem; }

    .platform-row {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .platform-row mat-icon {
      color: #1e40af;
      font-size: 1.5rem;
    }

    .platform-info {
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    .platform-info strong {
      color: #1e293b;
      font-size: 0.95rem;
    }

    .handle {
      color: #64748b;
      font-size: 0.85rem;
    }

    .contact-section { text-align: center; }

    .contact-card {
      padding: 3rem 2rem;
      text-align: center;
    }

    .contact-icon {
      font-size: 2.5rem;
      width: 40px;
      height: 40px;
      color: #1e40af;
      margin-bottom: 0.5rem;
    }

    .contact-card h2 {
      margin: 0 0 0.5rem;
      color: #1e293b;
    }

    .contact-card p {
      color: #64748b;
      margin: 0 0 1.5rem;
    }
  `],
})
export class AboutComponent implements OnInit {
  content = inject(ContentService);

  ngOnInit(): void {
    this.content.load();
  }
}

export default AboutComponent;
