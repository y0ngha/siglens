import { render, screen } from '@testing-library/react';
import {
    ReplayCaret,
    ReplayLines,
    ReplayPauseButton,
    ReplaySources,
    ReplaySteps,
} from '@/shared/ui/ReplayParts';
import {
    parseReplayLine,
    revealLines,
    type ReplayTool,
} from '@/shared/lib/replay/replayScript';

describe('ReplayCaret', () => {
    it('renders an aria-hidden blinking caret', () => {
        const { container } = render(<ReplayCaret />);
        const caret = container.firstChild as HTMLElement;
        expect(caret).toHaveAttribute('aria-hidden', 'true');
        expect(caret.className).toContain('animate-pulse');
    });
});

describe('ReplaySteps', () => {
    const tools: ReplayTool[] = [
        {
            label: '주가 조회',
            pendingLabel: '주가 확인 중',
            subject: 'AAPL',
            ms: 500,
        },
        {
            label: '뉴스 조회',
            pendingLabel: '뉴스 확인 중',
            subject: '최근 7일',
            ms: 500,
        },
        {
            label: '재무 조회',
            pendingLabel: '재무 확인 중',
            subject: 'FY25',
            ms: 500,
        },
    ];

    it('shows the pending label and pulsing dot for steps not yet done', () => {
        render(<ReplaySteps tools={tools} done={1} />);

        // First tool finished → its done label shows.
        expect(screen.getByText('주가 조회')).toBeInTheDocument();
        // Remaining tools are still pending → pending labels show instead.
        expect(screen.getByText('뉴스 확인 중')).toBeInTheDocument();
        expect(screen.getByText('재무 확인 중')).toBeInTheDocument();
        expect(screen.queryByText('뉴스 조회')).not.toBeInTheDocument();
        expect(screen.queryByText('재무 조회')).not.toBeInTheDocument();
    });

    it('applies the finished (green dot, dimmer border) styling only to completed steps', () => {
        render(<ReplaySteps tools={tools} done={1} />);
        const items = screen.getAllByRole('listitem');

        expect(items[0]!.className).toContain('border-secondary-700');
        expect(items[1]!.className).toContain('border-border-control');
        expect(items[2]!.className).toContain('border-border-control');
    });

    it('renders every subject next to its label', () => {
        render(<ReplaySteps tools={tools} done={3} />);
        expect(screen.getByText('AAPL')).toBeInTheDocument();
        expect(screen.getByText('최근 7일')).toBeInTheDocument();
        expect(screen.getByText('FY25')).toBeInTheDocument();
    });
});

describe('ReplayLines', () => {
    it('groups consecutive <li> lines under one <ul> and <p> lines stand alone', () => {
        const lines = [
            parseReplayLine('p', 'Intro paragraph.'),
            parseReplayLine('li', 'First bullet'),
            parseReplayLine('li', 'Second bullet'),
            parseReplayLine('p', 'Closing paragraph.'),
        ];
        const reveal = revealLines(lines, 1000, false);

        render(<ReplayLines lines={lines} reveal={reveal} />);

        const list = screen.getByRole('list');
        expect(list.tagName).toBe('UL');
        expect(screen.getAllByRole('listitem')).toHaveLength(2);
        expect(screen.getByText('First bullet')).toBeInTheDocument();
        expect(screen.getByText('Second bullet')).toBeInTheDocument();
        expect(screen.getByText('Intro paragraph.')).toBeInTheDocument();
        expect(screen.getByText('Closing paragraph.')).toBeInTheDocument();
    });

    it('only reveals characters up to the streamed cut point, hiding lines with nothing shown yet', () => {
        const lines = [
            parseReplayLine('p', 'Hello world'),
            parseReplayLine('p', 'Second line not yet shown'),
        ];
        // Reveal only enough characters for the first line.
        const reveal = revealLines(lines, 5, true);

        render(<ReplayLines lines={lines} reveal={reveal} />);

        expect(screen.getByText('Hello')).toBeInTheDocument();
        expect(screen.queryByText('Hello world')).not.toBeInTheDocument();
        expect(screen.queryByText(/Second line/)).not.toBeInTheDocument();
    });

    it('renders the streaming caret only on the line currently being revealed', () => {
        const lines = [parseReplayLine('p', 'Streaming text')];
        const reveal = revealLines(lines, 5, true);

        const { container } = render(
            <ReplayLines lines={lines} reveal={reveal} />
        );

        expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(
            1
        );
    });

    it('does not render a caret once streaming has finished', () => {
        const lines = [parseReplayLine('p', 'Done text')];
        const reveal = revealLines(lines, 9, false);

        const { container } = render(
            <ReplayLines lines={lines} reveal={reveal} />
        );

        expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(
            0
        );
    });

    it('skips rendering an entire trailing group once none of its lines have been revealed yet', () => {
        const lines = [
            parseReplayLine('p', 'Revealed paragraph'),
            parseReplayLine('li', 'Not yet revealed bullet'),
        ];
        // Only enough characters for the first (p) line — the trailing <li>
        // group has nothing shown, so its whole group must render as nothing.
        const reveal = revealLines(lines, 5, true);

        render(<ReplayLines lines={lines} reveal={reveal} />);

        expect(screen.queryByRole('list')).not.toBeInTheDocument();
        expect(
            screen.queryByText(/Not yet revealed bullet/)
        ).not.toBeInTheDocument();
    });

    it('renders <b>/<up>/<down> tagged segments with their tone classes', () => {
        const lines = [
            parseReplayLine(
                'p',
                '<b>bold</b> <up>up</up> <down>down</down> plain'
            ),
        ];
        const reveal = revealLines(lines, 100, false);

        render(<ReplayLines lines={lines} reveal={reveal} />);

        expect(screen.getByText('bold').tagName).toBe('STRONG');
        expect(screen.getByText('bold').className).toContain(
            'text-secondary-50'
        );
        expect(screen.getByText('up').className).toContain(
            'text-ui-success-text'
        );
        expect(screen.getByText('down').className).toContain(
            'text-ui-danger-text'
        );
        // Plain runs are not wrapped in <strong>.
        expect(screen.queryByText('plain')?.tagName).not.toBe('STRONG');
    });
});

describe('ReplaySources', () => {
    it('renders the label, each source chip, and the as-of date', () => {
        render(
            <ReplaySources
                label="출처"
                sources={['FMP', 'SEC']}
                asOf="기준 2026-09-18 종가"
            />
        );

        expect(screen.getByText('출처')).toBeInTheDocument();
        expect(screen.getByText('FMP')).toBeInTheDocument();
        expect(screen.getByText('SEC')).toBeInTheDocument();
        expect(screen.getByText('· 기준 2026-09-18 종가')).toBeInTheDocument();
    });
});

describe('ReplayPauseButton', () => {
    it('shows the pause label and aria-pressed=false when not paused', () => {
        render(
            <ReplayPauseButton
                paused={false}
                onToggle={vi.fn()}
                pauseLabel="일시정지"
                resumeLabel="재생"
            />
        );
        const button = screen.getByRole('button', { name: '일시정지' });
        expect(button).toHaveAttribute('aria-pressed', 'false');
    });

    it('shows the resume label and aria-pressed=true when paused', () => {
        render(
            <ReplayPauseButton
                paused={true}
                onToggle={vi.fn()}
                pauseLabel="일시정지"
                resumeLabel="재생"
            />
        );
        const button = screen.getByRole('button', { name: '재생' });
        expect(button).toHaveAttribute('aria-pressed', 'true');
    });

    it('calls onToggle when clicked', () => {
        const onToggle = vi.fn();
        render(
            <ReplayPauseButton
                paused={false}
                onToggle={onToggle}
                pauseLabel="일시정지"
                resumeLabel="재생"
            />
        );
        screen.getByRole('button', { name: '일시정지' }).click();
        expect(onToggle).toHaveBeenCalledTimes(1);
    });
});
