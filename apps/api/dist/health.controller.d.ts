import { DataSource } from 'typeorm';
export declare class HealthController {
    private readonly dataSource;
    private databaseInitialization?;
    constructor(dataSource: DataSource);
    check(): Promise<{
        status: string;
        database: string;
        timestamp: string;
    }>;
}
