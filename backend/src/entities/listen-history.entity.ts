import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('listen_history')
export class ListenHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'track_id', type: 'varchar' })
  trackId: string;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'varchar' })
  artist: string;

  @Column({ name: 'thumbnail_url', type: 'varchar', nullable: true })
  thumbnailUrl: string | null;

  @CreateDateColumn({ name: 'listened_at', type: 'timestamp' })
  listenedAt: Date;
}