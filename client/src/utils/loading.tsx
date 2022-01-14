import React from 'react';
import ReactDOM from 'react-dom';
import {Progress, Spin} from 'antd';
import {Box} from "@mui/material";
import "./loading.css"

const taskCache = {};
export function loading(percent, task, status) {
    if (document.getElementById('botnav')) {
        if (percent === null) {
            if (status) {
                delete taskCache[task];
                // ReactDOM.render(null, document.getElementById('botnav'));
            } else {
                taskCache[task] = null;
                // ReactDOM.render(
                //     <>
                //         <Box className="description" id="description1"> {task} </Box>
                //         <Spin size="large"/>
                //     </>,
                //     document.getElementById('botnav')
                // );
            }
        } else {
            if (status) {
                taskCache[task] = null;
                // ReactDOM.render(
                //     <>
                //         <Box className="description" id="description1"> {task} </Box>
                //         
                //     </>, 
                //     document.getElementById('botnav')
                // );
            }
            else {
                taskCache[task] = percent.toFixed(1);
                // ReactDOM.render(
                //     <>
                //         <Box className="description" id="description2"> {task} </Box>
                //         <Progress type="circle" percent={percent.toFixed(1)} className="red-text" />
                //     </>,
                //     document.getElementById('botnav')
                // );
            }
        }
        const tasks: any[] = [];
        for (let t in taskCache) {
            if (taskCache[t]) {
                tasks.push(
                    <div key={t}>
                    <div className="description" > {t} </div>
                    <Progress 
                        size="small" 
                        type="circle" 
                        percent={taskCache[t]} 
                        className="red-text" />
                    </div>
                );
            } else {
                tasks.push(
                    <div key={t}>
                    <div className="description"> {t} </div>
                    <Spin size="large"/>
                    </div>
                )
            }
        }
        ReactDOM.render(tasks, document.getElementById('botnav'));
    }
}
