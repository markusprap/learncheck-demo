import type {ReactNode} from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  emoji: string;
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'AI-Powered Quiz Generation',
    emoji: '🤖',
    description: (
      <>
        Generate pertanyaan kuis berkualitas tinggi secara otomatis menggunakan
        Google Gemini AI dari konten tutorial Dicoding.
      </>
    ),
  },
  {
    title: 'Simple & Reliable',
    emoji: '⚡',
    description: (
      <>
        Arsitektur sederhana tanpa dependency eksternal. 
        Direct API calls untuk reliability maksimal dan setup yang mudah.
      </>
    ),
  },
  {
    title: 'Real-Time Sync',
    emoji: '🔄',
    description: (
      <>
        Sinkronisasi preferensi user (tema, font size, font style) secara 
        real-time dengan latency hanya 500ms dari Dicoding Classroom.
      </>
    ),
  },
];

function Feature({title, emoji, description}: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        <span style={{fontSize: '4rem'}} role="img">{emoji}</span>
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
