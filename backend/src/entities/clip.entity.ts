import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('clips')
export class Clip {
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

  @Column({ name: 'start_time', type: 'int' })
  startTime: number;

  @Column({ name: 'end_time', type: 'int' })
  endTime: number;

  @Column({ name: 'short_code', type: 'varchar', unique: true })
  shortCode: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}
