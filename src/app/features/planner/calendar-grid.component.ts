// src/app/features/planner/calendar-grid.component.ts
import { Component, input, output } from '@angular/core';
import { CalendarItem } from './planner.service';
import { CalendarCardComponent } from './calendar-card.component';

@Component({
  selector: 'app-calendar-grid',
  standalone: true,
  imports: [CalendarCardComponent],
  template: `
    <div class="grid">
      @for (day of days(); track day) {
        <div class="day-column"
             (dragover)="onDragOver($event)"
             (drop)="onDrop($event, day)">
          <div class="day-header">
            <span class="day-name">{{ getDayName(day) }}</span>
            <span class="day-date">{{ day }}</span>
          </div>
          <div class="day-items">
            @for (item of getItemsForDay(day); track item.id) {
              <app-calendar-card
                [item]="item"
                (itemApproved)="itemApproved.emit($event)"
                (itemRejected)="itemRejected.emit($event)"
                (itemUpdated)="itemUpdated.emit($event)"
                (dragStarted)="onCardDragStart($event)"
              />
            }
            @if (getItemsForDay(day).length === 0) {
              <div class="empty-slot">No items</div>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 8px;
      min-height: 400px;
    }
    .day-column {
      background: #0f172a;
      border-radius: 8px;
      padding: 8px;
      min-height: 300px;
      border: 2px solid transparent;
      transition: border-color 0.15s;
    }
    .day-column.drag-over { border-color: #3b82f6; }
    .day-header {
      text-align: center;
      padding: 8px 0;
      border-bottom: 1px solid #1e293b;
      margin-bottom: 8px;
    }
    .day-name { display: block; font-weight: 600; color: #e2e8f0; font-size: 13px; }
    .day-date { display: block; font-size: 11px; color: #64748b; }
    .day-items { min-height: 200px; }
    .empty-slot {
      text-align: center; color: #475569; font-size: 12px; padding: 20px 0; font-style: italic;
    }
    @media (max-width: 1200px) {
      .grid { grid-template-columns: repeat(4, 1fr); }
    }
    @media (max-width: 768px) {
      .grid { grid-template-columns: repeat(2, 1fr); }
    }
  `],
})
export class CalendarGridComponent {
  days = input.required<string[]>();
  items = input.required<CalendarItem[]>();

  itemApproved = output<CalendarItem>();
  itemRejected = output<CalendarItem>();
  itemUpdated = output<{ id: number; updates: Partial<CalendarItem> }>();
  itemMoved = output<{ id: number; newDay: string }>();

  private draggedItem: CalendarItem | null = null;

  private readonly DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  getDayName(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00Z');
    return this.DAY_NAMES[d.getUTCDay()];
  }

  getItemsForDay(day: string): CalendarItem[] {
    return this.items().filter(i => i.day === day).sort((a, b) => a.slot - b.slot);
  }

  onCardDragStart(event: { event: DragEvent; item: CalendarItem }): void {
    this.draggedItem = event.item;
    if (event.event.dataTransfer) {
      event.event.dataTransfer.effectAllowed = 'move';
      event.event.dataTransfer.setData('text/plain', String(event.item.id));
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    const col = (event.currentTarget as HTMLElement);
    col.classList.add('drag-over');
  }

  onDrop(event: DragEvent, day: string): void {
    event.preventDefault();
    const col = (event.currentTarget as HTMLElement);
    col.classList.remove('drag-over');

    if (this.draggedItem && this.draggedItem.day !== day) {
      this.itemMoved.emit({ id: this.draggedItem.id, newDay: day });
    }
    this.draggedItem = null;
  }
}
