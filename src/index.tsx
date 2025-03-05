import { StrictMode, startTransition, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import styles from './style.module.css';

fetch('/list')
    .then(r => r.json())
    .then(songs => {
        const div = document.createElement('div');
        document.body.appendChild(div);
        createRoot(div).render(<Application files={shuffle(songs as Song[])} />);
    });

function fetchData(url: string): Promise<string> {
    return fetch(url)
    .then(r => {
        if (r.ok) {
            return r.blob().then(URL.createObjectURL);
        } else {
            return new Promise((resolve, reject) => {
                reject("Network not OK: " + r.status);
            });
        }
    })
}

const Application = ({ files }: { files: Song[] }) => {
    const [playlist, setPlaylist] = useState<Song[]>(files.slice(0, 300));
    const [current, setCurrent] = useState<number>(0);
    useEffect(() => {
        const cur = playlist.at(current);
        if (!cur) {
            const copy = [...files];
            setPlaylist(shuffle(copy).slice(0,300));
            setCurrent(0);
            return;
        }
        document.title = "Music " + cur.Title;
        navigator.mediaSession.metadata = new MediaMetadata({
            album: cur.Album,
            artist: cur.Artist,
            title: cur.Title,
            artwork: [
                {
                    src: ""
                }
            ]
        })
    }, [current, playlist]);
    const ref = useRef<HTMLAudioElement>(null);
    useEffect(() => {
        const fixPosition = () => {
            if (!ref.current) {
                return;
            } 
            navigator.mediaSession.setPositionState({
            duration: ref.current.duration,
            playbackRate: ref.current.playbackRate,
            position: ref.current.currentTime
          });
        }
        navigator.mediaSession.setActionHandler("nexttrack", () => {
            setCurrent(prev => prev + 1);
            fixPosition();
        });
        navigator.mediaSession.setActionHandler("previoustrack", () => {
            setCurrent(prev => prev - 1);
            fixPosition();
        });
        navigator.mediaSession.setActionHandler("play", () => {
            ref.current?.play();
            fixPosition();
        });
        navigator.mediaSession.setActionHandler("pause", () => {
            ref.current?.pause();
            fixPosition();
        });
        navigator.mediaSession.setActionHandler("seekto", (e) => {
            if (!ref.current) {
                return;
            }
            ref.current.currentTime = e.seekTime;
            fixPosition();
        });
    }, []);
    return <StrictMode>
        <button onClick={(e) => setPlaylist(shuffle(files).slice(0,300))}>Play random</button>
        <div style={{maxHeight: '500px', display: 'flex', overflow: 'scroll'}}>
            <table style={{ maxHeight: '500px'}}>
                {playlist.map((song, index) => <tr key={song.Id}
                    onClick={(e) => setCurrent(index)} style={{ cursor: 'pointer' }}
                    draggable
                    onDragStart={(e) => {
                        e.dataTransfer.setData("song", index.toString(10));
                        e.dataTransfer.dropEffect = "move";
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                        const oldIndex = parseInt(e.dataTransfer.getData("song"), 10);
                        setPlaylist(prev => {
                            const copy = [...prev];
                            copy.splice(oldIndex > index ? index : index + 1, 0, copy.at(oldIndex));
                            copy.splice(oldIndex > index ? oldIndex + 1 : oldIndex, 1);
                            return copy;
                        });
                     }}>
                <td>{index == current ? '>' : ''}</td>
                    <td>{song.Artist}</td>
                    <td>{song.Album}</td>
                    <td>{song.Title}</td>
                    <td onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPlaylist(prev => prev.filter(s => s.Id !== song.Id)) }}>X</td>
            </tr>)}
            </table></div>
        <audio ref={ref} controls src={`${playlist.at(current)?.Path ?? ''}`} autoPlay onEnded={(e) => setCurrent(prev => prev + 1)}
                onError={(e) => {
                    console.log(e);
                    setTimeout(() => setCurrent(prev => prev + 1), 15000);
                }}
                onStalled={(e) => {
                    console.log(e);
                    setTimeout(() => {
                        ref.current?.load();
                    }, 15000);
                }}></audio>
        <Searcher addToList={(file, append) => startTransition(() => {
            if (append) {
                setPlaylist(prev => {
                    const copy = [...prev]
                    copy.splice(current + 1, 0, ...file);
                    return copy;
                });
            } else {
                setPlaylist(file);
                setCurrent(0);
            }
        })} files={files}></Searcher>
    </StrictMode>
};

type Adder = (file: Song[], append: boolean) => void

interface Song {
    Id: number,
    Title: string,
    Album: string,
    Artist: string,
    Path: string
    EpochMillis: number
}

const Searcher = ({ addToList, files }: { addToList: Adder, files: Song[] }) => {
    const [search, setSearch] = useState(''); 
    const [filteredFiles, setFilteredFiles] = useState<Song[]>([]);
    useEffect(() => {
        if (search === '') {
            setFilteredFiles([]);
            return;
        }
        const newFilter = files.filter(file => {
            return file.Artist.toLowerCase().includes(search) || file.Album.toLowerCase().includes(search) || file.Title.toLowerCase().includes(search);
        });
        newFilter.sort();
        setFilteredFiles(newFilter);
    }, [search, files]);
    return <>
        <div>
            <input type='text' placeholder='search' value={search} onChange={(e) => setSearch(e.target.value)}></input>
        </div>
        <div>
            <SearchResults songs={filteredFiles} addToList={addToList}></SearchResults>
        </div>
    </>
}

interface TreeNode {
    name: string,
    nodes: Map<string, TreeNode>,
    song?: Song
}

const recursiveAllSongs = (arg0: TreeNode) => { 
    const result: Song[] = [];
    if (arg0.song) {
        result.push(arg0.song);
    }
    for (const node of arg0.nodes.values()) {
        result.push(...recursiveAllSongs(node));
    }
    result.sort((a,b) => a.Id - b.Id)
    return result;
};

const SearchResults = ({ songs, addToList }: { songs: Song[], addToList: Adder }) => {
    const artists = useMemo(() => {
        const result: Map<string,TreeNode> = new Map();
        songs.forEach(s => {
            const artistNode = result.get(s.Artist) ?? { name: s.Artist, nodes: new Map<string, TreeNode>() };
            result.set(artistNode.name, artistNode);
            const albumNode = artistNode.nodes.get(s.Album) ?? { name: s.Album, nodes: new Map<string, TreeNode>() };
            artistNode.nodes.set(albumNode.name, albumNode);
            albumNode.nodes.set(s.Title, { name: s.Title, nodes: new Map(), song: s });
        });
        return result;
    }, [songs]);
    return <ul>
        <RenderTree node={{ name: '', nodes: artists }} addToList={addToList}/>
    </ul>;
};

const RenderTree = ({ node, addToList }: { node: TreeNode, addToList: Adder }) => {
    const [ulOpen, setUlOpen] = useState(false);
    useEffect(() => {
        setUlOpen(node.nodes.size <= 3);
    }, [node.nodes]);
    const list: TreeNode[] = [];
    for (const value of node.nodes.values()) {
        list.push(value);
    }
    list.sort((a, b) => a.name.localeCompare(b.name));
    const songNum = useMemo(() => recursiveAllSongs(node).length, [node]);
    return <li>
        <span className={list.length === 0 ? '' : styles.caret}
            onClick={(e) => setUlOpen(prev => !prev)}>
            {songNum === 1 ? <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); addToList(recursiveAllSongs(node), true) }}>Play next {node.name}</button>
                :
                <>
                    <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); addToList(shuffle(recursiveAllSongs(node)), false) }}>Play {node.name}</button>
                    <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); addToList(recursiveAllSongs(node), false) }}>Play in order {node.name}</button>
                </>
            }
        </span>
        <ul className={`${styles.nested} ${ulOpen ? styles.active : ''}`} >
            {list.map(node => <RenderTree node={node} addToList={addToList} />)}
        </ul>
    </li>
}

function shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--)
    {
        const n = Math.floor(Math.random() * (i+1));
        const toSwap = items.at(i);
        const other = items.at(n);
        items[i] = other;
        items[n] = toSwap;
    }
    return items;
}
